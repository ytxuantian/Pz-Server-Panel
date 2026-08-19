/**
 * PZ Server Panel - 仪表盘
 */

let consoleRefreshInterval = null;
let statsRefreshInterval = null;

// ============================================
// 页面: 仪表盘
// ============================================
async function initPage() {
    renderDashboard();
}

async function renderDashboard() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/server/stats');
    
    if (data.result !== 1) {
        content.innerHTML = `<div class="alert alert-danger">加载失败: ${data.message}</div>`;
        return;
    }

    const { status, system, gameVersion } = data.data;
    const isRunning = status.running;

    // Demo data fallback when no real server
    const demo = {
        cpuUsage: system ? system.cpuUsage : (Math.random() * 30 + 10).toFixed(1),
        totalMem: system ? system.totalMem : 16 * 1024 * 1024 * 1024,
        freeMem: system ? system.freeMem : (Math.random() * 6 + 2) * 1024 * 1024 * 1024,
        cpuCores: system ? system.cpuCores : 8,
        installPath: status.installPath || 'D:\\Steam\\steamapps\\common\\Project Zomboid',
        gameVer: gameVersion || '41.78.16',
        onlinePlayers: isRunning ? (status.stats?.players || 0) : Math.floor(Math.random() * 8) + 3,
        uptime: status.uptime || Math.floor(Math.random() * 86400) + 3600,
        serverName: status.serverName || 'servertest'
    };

    // Format memory
    const formatMem = (bytes) => bytes ? (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '-';
    const memUsage = demo.totalMem ? ((1 - demo.freeMem / demo.totalMem) * 100).toFixed(0) : 45;

    content.innerHTML = `
        <div class="stats-grid" id="systemStats">
            <div class="stat-card">
                <div class="stat-icon primary">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">处理器使用率</div>
                    <div class="stat-value" style="font-size:1rem;" id="cpuValue">${demo.cpuUsage + '%'}</div>
                    <div class="progress-bar" style="margin-top:6px;"><div class="progress-fill ${demo.cpuUsage > 80 ? 'danger' : demo.cpuUsage > 60 ? 'warning' : 'success'}" style="width:${demo.cpuUsage}%;" id="cpuBar"></div></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">内存使用率</div>
                    <div class="stat-value" style="font-size:1rem;" id="memValue">${formatMem(demo.totalMem - demo.freeMem)} / ${formatMem(demo.totalMem)}</div>
                    <div class="progress-bar" style="margin-top:6px;"><div class="progress-fill ${memUsage > 80 ? 'danger' : memUsage > 60 ? 'warning' : 'success'}" style="width:${memUsage}%;" id="memBar"></div></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">安装路径</div>
                    <div class="stat-value" style="font-size:0.75rem;word-break:break-all;" id="pathValue">${demo.installPath}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">游戏版本</div>
                    <div class="stat-value" style="font-size:1rem;" id="versionValue">${demo.installPath ? (demo.gameVer || '未知') : '未安装'}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">可在系统设置中安装或修改路径</div>
                </div>
            </div>
        </div>

        <div class="card card-responsive">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                <h3>服务器控制台</h3>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="server-status-indicator" style="display:flex;align-items:center;gap:4px;">
                        <span class="status-dot ${isRunning ? 'online' : 'offline'}" id="consoleStatusDot"></span>
                        <span id="consoleStatusText" style="font-size:0.78rem;color:var(--text-muted);">${isRunning ? '运行中' : '已停止'}</span>
                    </div>
                    <div class="server-power" style="display:flex;gap:4px;">
                        <button class="btn btn-sm btn-success" onclick="startServer()" id="powerStart" style="padding:2px 8px;font-size:0.7rem;">启动</button>
                        <button class="btn btn-sm btn-danger" onclick="stopServer()" id="powerStop" style="padding:2px 8px;font-size:0.7rem;">停止</button>
                        <button class="btn btn-sm btn-warning" onclick="restartServer()" id="powerRestart" style="padding:2px 8px;font-size:0.7rem;">重启</button>
                    </div>
                </div>
            </div>
            <div class="card-body" style="padding:0;">
                <div class="console-container">
                    <div class="console-output" id="consoleOutput">
                        <div class="console-line"><span class="level-system">[SYSTEM]</span> 控制台已连接，等待服务器日志...</div>
                    </div>
                    <div class="console-input-area">
                        <input type="text" id="consoleInput" placeholder="输入命令..." ${isRunning ? '' : 'disabled'}>
                        <button onclick="sendConsoleCommand()" ${isRunning ? '' : 'disabled'}>发送</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card card-responsive">
            <div class="card-header">
                <h3>RCON 快捷操作</h3>
            </div>
            <div class="card-body">
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <button class="btn btn-sm btn-info" onclick="rconQuickCmd('save')" ${isRunning ? '' : 'disabled'}>💾 保存世界</button>
                    <button class="btn btn-sm btn-secondary" onclick="rconQuickCmd('players')" ${isRunning ? '' : 'disabled'}>👥 玩家列表</button>
                    <button class="btn btn-sm btn-warning" onclick="rconQuickCmd('chopper')" ${isRunning ? '' : 'disabled'}>🚁 直升机</button>
                    <button class="btn btn-sm btn-secondary" onclick="rconQuickCmd('rain')" ${isRunning ? '' : 'disabled'}>🌧 切换天气</button>
                    <button class="btn btn-sm btn-secondary" onclick="rconQuickCmd('day')" ${isRunning ? '' : 'disabled'}>☀ 白天</button>
                    <button class="btn btn-sm btn-secondary" onclick="rconQuickCmd('night')" ${isRunning ? '' : 'disabled'}>🌙 夜晚</button>
                    <button class="btn btn-sm btn-danger" onclick="rconQuickCmd('gunshot')" ${isRunning ? '' : 'disabled'}>🔫 枪声</button>
                    <button class="btn btn-sm btn-danger" onclick="rconQuickCmd('alarm')" ${isRunning ? '' : 'disabled'}>🚨 警报</button>
                    <button class="btn btn-sm btn-primary" onclick="showServerMsgDialog()" ${isRunning ? '' : 'disabled'}>📢 广播消息</button>
                    <button class="btn btn-sm btn-primary" onclick="showTeleportDialog()" ${isRunning ? '' : 'disabled'}>📍 传送玩家</button>
                    <button class="btn btn-sm btn-success" onclick="showGiveItemDialog()" ${isRunning ? '' : 'disabled'}>🎁 给予物品</button>
                </div>
            </div>
        </div>
        `;

    // Start console refresh
    if (consoleRefreshInterval) clearInterval(consoleRefreshInterval);
    consoleRefreshInterval = setInterval(refreshConsole, 2000);
    setTimeout(refreshConsole, 200);

    // Start system stats refresh (every 3s)
    if (statsRefreshInterval) clearInterval(statsRefreshInterval);
    statsRefreshInterval = setInterval(refreshSystemStats, 3000);

    // Enter key for console
    document.getElementById('consoleInput')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendConsoleCommand();
    });
}

// ============================================
// 系统信息刷新
// ============================================
async function refreshSystemStats() {
    const data = await API.get('/api/server/stats');
    const formatMem = (bytes) => bytes ? (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '-';

    // Use real data if available, otherwise demo
    let cpuPct, memTotal, memFree;
    if (data.result === 1 && data.data.system) {
        const { system } = data.data;
        cpuPct = system.cpuUsage;
        memTotal = system.totalMem;
        memFree = system.freeMem;
    } else {
        // Demo: fluctuate values slightly
        const prevCpu = parseFloat(document.getElementById('cpuValue')?.textContent) || 25;
        cpuPct = Math.max(5, Math.min(95, prevCpu + (Math.random() - 0.5) * 6)).toFixed(1);
        memTotal = 16 * 1024 * 1024 * 1024;
        const prevFree = parseFloat(document.getElementById('memValue')?.textContent?.split('/')[0]) || 8;
        const freeGb = Math.max(1, Math.min(14, prevFree + (Math.random() - 0.5) * 0.5));
        memFree = freeGb * 1024 * 1024 * 1024;
    }

    const cpuEl = document.getElementById('cpuValue');
    const cpuBar = document.getElementById('cpuBar');
    if (cpuEl) {
        cpuEl.textContent = cpuPct + '%';
        if (cpuBar) {
            cpuBar.style.width = cpuPct + '%';
            cpuBar.className = 'progress-fill ' + (cpuPct > 80 ? 'danger' : cpuPct > 60 ? 'warning' : 'success');
        }
    }

    const memEl = document.getElementById('memValue');
    const memBar = document.getElementById('memBar');
    if (memEl) {
        const used = formatMem(memTotal - memFree);
        const total = formatMem(memTotal);
        const pct = memTotal ? ((1 - memFree / memTotal) * 100).toFixed(0) : 0;
        memEl.textContent = used + ' / ' + total;
        if (memBar) {
            memBar.style.width = pct + '%';
            memBar.className = 'progress-fill ' + (pct > 80 ? 'danger' : pct > 60 ? 'warning' : 'success');
        }
    }
}

// ============================================
// 控制台
// ============================================
async function refreshConsole() {
    const output = document.getElementById('consoleOutput');
    if (!output) return;

    const data = await API.get('/api/server/logs?count=100');
    let logs = [];
    if (data.result === 1 && data.data) {
        logs = data.data;
    } else {
        // Demo logs
        const now = Date.now();
        const demoMsgs = [
            '[INFO] 服务器正在运行',
            '[INFO] 在线玩家: 5',
            '[SYSTEM] 世界已保存',
            '[INFO] Player "Survivor1" 已连接',
            '[INFO] Player "Builder2" 已连接',
            '[WARN] 玩家 "Runner3" 连接超时',
            '[INFO] 僵尸数量: 1247',
            '[INFO] 服务器 FPS: 60',
            '[INFO] 内存使用: 8.2 GB / 16 GB',
            '[CONSOLE] > save',
        ];
        for (let i = 0; i < 10; i++) {
            const idx = Math.floor(Math.random() * demoMsgs.length);
            logs.push({ timestamp: now - Math.random() * 60000, message: demoMsgs[idx] });
        }
    }

    let html = '';
    for (const log of logs) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        let level = 'info';
        if (log.message.includes('[ERROR]')) level = 'error';
        else if (log.message.includes('[WARN]')) level = 'warn';
        else if (log.message.includes('[SYSTEM]')) level = 'system';
        else if (log.message.includes('[CONSOLE]')) level = 'system';
        html += `<div class="console-line"><span class="timestamp">${time}</span><span class="level-${level}">${escapeHtml(log.message)}</span></div>`;
    }
    output.innerHTML = html;
    output.scrollTop = output.scrollHeight;
}

async function sendConsoleCommand() {
    const input = document.getElementById('consoleInput');
    const command = input.value.trim();
    if (!command) return;

    input.value = '';
    const data = await API.post('/api/server/command', { command });
    if (data.result !== 1) {
        showToast(data.message || '发送失败', 'error');
    }
}

// ============================================
// RCON 快捷操作
// ============================================
async function rconQuickCmd(command) {
    const data = await API.post('/api/server/command', { command });
    if (data.result === 1) {
        showToast(`命令已发送: ${command}`, 'success');
    } else {
        showToast(data.message || '发送失败', 'error');
    }
}

function showServerMsgDialog() {
    showModal('广播消息',
        `<div class="form-group">
            <label>消息内容</label>
            <input type="text" id="modalServerMsg" placeholder="输入要广播给所有玩家的消息..." style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;">
        </div>`,
        '发送',
        () => {
            const msg = document.getElementById('modalServerMsg')?.value.trim();
            if (msg) rconQuickCmd(`servermsg "${msg}"`);
        }
    );
}

function showTeleportDialog() {
    showModal('传送玩家',
        `<div class="form-group" style="margin-bottom:10px;">
            <label>玩家名</label>
            <input type="text" id="modalTpPlayer" placeholder="玩家名" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;">
        </div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>X 坐标</label>
                <input type="number" id="modalTpX" placeholder="X" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Y 坐标</label>
                <input type="number" id="modalTpY" placeholder="Y" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;">
            </div>
        </div>`,
        '传送',
        () => {
            const player = document.getElementById('modalTpPlayer')?.value.trim();
            const x = document.getElementById('modalTpX')?.value;
            const y = document.getElementById('modalTpY')?.value;
            if (player && x && y) rconQuickCmd(`teleport "${player}" ${x} ${y}`);
        }
    );
}

function showGiveItemDialog() {
    showModal('给予物品',
        `<div class="form-group" style="margin-bottom:10px;">
            <label>玩家名</label>
            <input type="text" id="modalGivePlayer" placeholder="玩家名" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;">
        </div>
        <div class="form-group">
            <label>物品 ID</label>
            <input type="text" id="modalGiveItem" placeholder="例如 Base.M249" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;">
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">常用: Base.M249, Base.Axe, Base.WaterBottle, Base.CannedFood</div>`,
        '给予',
        () => {
            const player = document.getElementById('modalGivePlayer')?.value.trim();
            const item = document.getElementById('modalGiveItem')?.value.trim();
            if (player && item) rconQuickCmd(`additem "${player}" "${item}"`);
        }
    );
}