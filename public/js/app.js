/**
 * PZ Server Panel - 主应用脚本
 */

// ============================================
// API 工具
// ============================================
const API = {
    getSessionKey() {
        return sessionStorage.getItem('sessionKey');
    },

    getUsername() {
        return sessionStorage.getItem('username') || 'admin';
    },

    async request(method, url, body = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        // Add session key to URL
        const separator = url.includes('?') ? '&' : '?';
        const urlWithKey = `${url}${separator}key=${this.getSessionKey()}`;

        try {
            const response = await fetch(urlWithKey, options);
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('API请求失败:', err);
            return { result: 0, message: '网络错误' };
        }
    },

    get(url) {
        return this.request('GET', url);
    },

    post(url, body) {
        return this.request('POST', url, body);
    }
};

// ============================================
// 页面路由
// ============================================
const PAGES = {
    dashboard: { title: '仪表盘', render: renderDashboard },
    server: { title: '服务器控制', render: renderServerControl },
    players: { title: '玩家管理', render: renderPlayers },
    config: { title: '配置文件', render: renderConfig },
    mods: { title: 'Mod 管理', render: renderMods },
    map: { title: '地图', render: renderMap },
    logs: { title: '日志查看', render: renderLogs },
    backups: { title: '备份管理', render: renderBackups },
    settings: { title: '系统设置', render: renderSettings }
};

let currentPage = 'dashboard';
let statusCheckInterval = null;
let consoleRefreshInterval = null;

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Check session
    const sessionKey = API.getSessionKey();
    if (!sessionKey) {
        window.location.href = '/login';
        return;
    }

    // Verify session
    API.get('/api/check_session').then(data => {
        if (data.result !== 1) {
            window.location.href = '/login';
            return;
        }
        
        // Set username
        const username = API.getUsername();
        document.getElementById('userName').textContent = username;
        document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();

        // Start periodic status check
        startStatusCheck();
        
        // Load initial page
        navigateTo('dashboard');
    });
});

// ============================================
// 导航
// ============================================
function navigateTo(page, navItem) {
    if (!PAGES[page]) return;
    
    currentPage = page;
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navItem) {
        navItem.classList.add('active');
    } else {
        const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navEl) navEl.classList.add('active');
    }
    
    // Update page title
    document.getElementById('pageTitle').textContent = PAGES[page].title;
    
    // Render page
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="page-loading"><svg class="spinner" viewBox="0 0 24 24" width="32" height="32"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg><span>加载中...</span></div>';
    
    // Stop console refresh if leaving server page
    if (page !== 'server' && consoleRefreshInterval) {
        clearInterval(consoleRefreshInterval);
        consoleRefreshInterval = null;
    }
    
    setTimeout(() => PAGES[page].render(), 100);
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ============================================
// 服务器状态检查
// ============================================
function startStatusCheck() {
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    statusCheckInterval = setInterval(checkServerStatus, 5000);
    checkServerStatus();
}

async function checkServerStatus() {
    const data = await API.get('/api/server/status');
    if (data.result === 1) {
        const status = data.data;
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        
        if (status.running) {
            dot.className = 'status-dot online';
            const uptime = formatUptime(status.uptime);
            text.textContent = `运行中 (${uptime})`;
        } else {
            dot.className = 'status-dot offline';
            text.textContent = '已停止';
        }
    }
}

function formatUptime(seconds) {
    if (!seconds) return '0秒';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}时${m}分`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
}

// ============================================
// 登出
// ============================================
function logout() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    if (consoleRefreshInterval) {
        clearInterval(consoleRefreshInterval);
        consoleRefreshInterval = null;
    }
    sessionStorage.removeItem('sessionKey');
    sessionStorage.removeItem('username');
    window.location.href = '/login';
}

// ============================================
// Modal
// ============================================
let modalCallback = null;

function showModal(title, bodyHtml, confirmText, callback) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalConfirmBtn').textContent = confirmText || '确认';
    document.getElementById('modalOverlay').classList.add('show');
    modalCallback = callback || null;
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    modalCallback = null;
}

function modalConfirm() {
    if (modalCallback) {
        modalCallback();
    }
    closeModal();
}

// ============================================
// 页面: 仪表盘
// ============================================
async function renderDashboard() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/server/stats');
    
    if (data.result !== 1) {
        content.innerHTML = `<div class="alert alert-danger">加载失败: ${data.message}</div>`;
        return;
    }

    const { status, playerHistory } = data.data;
    const isRunning = status.running;

    content.innerHTML = `
        <div class="page-header">
            <h2>仪表盘</h2>
            <p>Project Zomboid 服务器概览</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon ${isRunning ? 'success' : 'warning'}">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                        <circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">服务器状态</div>
                    <div class="stat-value">${isRunning ? '运行中' : '已停止'}</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon info">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">在线玩家</div>
                    <div class="stat-value">${isRunning ? (status.stats.players || 0) : '-'}</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon primary">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">运行时间</div>
                    <div class="stat-value">${isRunning ? formatUptime(status.uptime) : '-'}</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon ${isRunning ? 'success' : 'warning'}">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <div class="stat-label">服务器名</div>
                    <div class="stat-value" style="font-size:1rem;">${status.serverName || 'servertest'}</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>快速操作</h3>
            </div>
            <div class="card-body">
                <div class="server-controls">
                    ${isRunning ? `
                        <button class="btn btn-danger" onclick="stopServer()">停止服务器</button>
                        <button class="btn btn-warning" onclick="restartServer()">重启服务器</button>
                        <button class="btn btn-info" onclick="saveAll()">保存世界</button>
                    ` : `
                        <button class="btn btn-success" onclick="startServer()">启动服务器</button>
                    `}
                    <button class="btn btn-secondary" onclick="navigateTo('players')">查看玩家</button>
                    <button class="btn btn-secondary" onclick="navigateTo('logs')">查看日志</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>近期玩家活动</h3>
            </div>
            <div class="card-body">
                ${playerHistory && playerHistory.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>时间</th>
                                    <th>在线人数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${playerHistory.map(p => `
                                    <tr>
                                        <td>${new Date(p.time).toLocaleTimeString()}</td>
                                        <td><span class="badge badge-info">${p.count} 人</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        </svg>
                        <h3>暂无玩家活动数据</h3>
                        <p>服务器启动后将显示玩家活动记录</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// ============================================
// 页面: 服务器控制
// ============================================
async function renderServerControl() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/server/status');
    const status = data.result === 1 ? data.data : { running: false };
    const isRunning = status.running;

    content.innerHTML = `
        <div class="page-header">
            <h2>服务器控制</h2>
            <p>启动、停止和管理 Project Zomboid 服务器</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>服务器状态</h3>
                <div>
                    <span class="badge ${isRunning ? 'badge-success' : 'badge-danger'}">${isRunning ? '运行中' : '已停止'}</span>
                </div>
            </div>
            <div class="card-body">
                <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-label">进程 PID</div>
                            <div class="stat-value" style="font-size:1rem;">${isRunning ? status.pid : '-'}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-label">运行时间</div>
                            <div class="stat-value" style="font-size:1rem;">${isRunning ? formatUptime(status.uptime) : '-'}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-label">安装路径</div>
                            <div class="stat-value" style="font-size:0.8rem;word-break:break-all;">${status.installPath || '-'}</div>
                        </div>
                    </div>
                </div>
                <div class="server-controls" style="margin-top:16px;">
                    ${isRunning ? `
                        <button class="btn btn-danger" onclick="stopServer()">停止服务器</button>
                        <button class="btn btn-warning" onclick="restartServer()">重启服务器</button>
                    ` : `
                        <button class="btn btn-success" onclick="startServer()">启动服务器</button>
                    `}
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>服务器控制台</h3>
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
    `;

    // Start console refresh
    if (consoleRefreshInterval) clearInterval(consoleRefreshInterval);
    consoleRefreshInterval = setInterval(refreshConsole, 2000);
    setTimeout(refreshConsole, 200);

    // Enter key for console
    document.getElementById('consoleInput')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendConsoleCommand();
    });
}

async function refreshConsole() {
    const output = document.getElementById('consoleOutput');
    if (!output) return;

    const data = await API.get('/api/server/logs?count=100');
    if (data.result === 1 && data.data) {
        let html = '';
        for (const log of data.data) {
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
// 服务器操作
// ============================================
async function startServer() {
    const btn = event?.target;
    if (btn) btn.disabled = true;
    
    const data = await API.post('/api/server/start');
    if (data.result === 1) {
        showToast('服务器启动成功', 'success');
        navigateTo('server');
    } else {
        showToast(data.message || '启动失败', 'error');
        if (btn) btn.disabled = false;
    }
}

async function stopServer() {
    if (!confirm('确定要停止服务器吗？所有在线玩家将被断开连接。')) return;
    
    const data = await API.post('/api/server/stop');
    if (data.result === 1) {
        showToast('服务器已停止', 'success');
        navigateTo('server');
    } else {
        showToast(data.message || '停止失败', 'error');
    }
}

async function restartServer() {
    if (!confirm('确定要重启服务器吗？所有在线玩家将被断开连接。')) return;
    
    const btn = event?.target;
    if (btn) btn.disabled = true;
    
    showToast('正在重启服务器...', 'info');
    const data = await API.post('/api/server/restart');
    if (data.result === 1) {
        showToast('服务器重启中', 'success');
    } else {
        showToast(data.message || '重启失败', 'error');
        if (btn) btn.disabled = false;
    }
}

async function saveAll() {
    const data = await API.post('/api/players/saveall');
    if (data.result === 1) {
        showToast('世界已保存', 'success');
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

// ============================================
// 页面: 玩家管理
// ============================================
async function renderPlayers() {
    const content = document.getElementById('pageContent');
    const [onlineData, allData] = await Promise.all([
        API.get('/api/players/online'),
        API.get('/api/players/all')
    ]);

    const onlinePlayers = onlineData.result === 1 ? onlineData.data.players : [];
    const allPlayers = allData.result === 1 ? allData.data.players : [];
    const onlineCount = onlineData.result === 1 ? onlineData.data.count : 0;

    content.innerHTML = `
        <div class="page-header">
            <h2>玩家管理</h2>
            <p>管理在线玩家、发送消息、执行操作</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>操作</h3>
            </div>
            <div class="card-body">
                <div class="inline-form">
                    <input type="text" id="playerTarget" placeholder="玩家名" style="width:150px;">
                    <input type="text" id="playerMessage" placeholder="消息内容" style="width:200px;">
                    <button class="btn btn-primary btn-sm" onclick="sendPlayerMessage()">发送消息</button>
                    <input type="text" id="kickReason" placeholder="踢出原因" style="width:150px;">
                    <button class="btn btn-warning btn-sm" onclick="kickPlayer()">踢出</button>
                    <input type="text" id="banReason" placeholder="封禁原因" style="width:150px;">
                    <button class="btn btn-danger btn-sm" onclick="banPlayer()">封禁</button>
                    <button class="btn btn-success btn-sm" onclick="saveAll()">保存所有</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>在线玩家 (${onlineCount})</h3>
            </div>
            <div class="card-body" style="padding:0;">
                ${onlinePlayers.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>玩家名</th>
                                    <th>连接时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${onlinePlayers.map(p => `
                                    <tr>
                                        <td><strong>${escapeHtml(p.name)}</strong></td>
                                        <td>${new Date(p.connectedAt).toLocaleString()}</td>
                                        <td>
                                            <div class="action-btns">
                                                <button class="btn btn-sm btn-info" onclick="setPlayerTarget('${escapeHtml(p.name)}')">选择</button>
                                                <button class="btn btn-sm btn-danger" onclick="kickPlayer('${escapeHtml(p.name)}')">踢出</button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state" style="padding:40px;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        </svg>
                        <h3>暂无在线玩家</h3>
                    </div>
                `}
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>全部玩家 (${allPlayers.length})</h3>
            </div>
            <div class="card-body" style="padding:0;">
                ${allPlayers.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>玩家名</th>
                                    <th>存档大小</th>
                                    <th>最后游玩</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allPlayers.slice(0, 50).map(p => `
                                    <tr>
                                        <td>${escapeHtml(p.name)}</td>
                                        <td>${formatSize(p.size)}</td>
                                        <td>${new Date(p.lastPlayed).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state" style="padding:40px;">
                        <h3>暂无玩家数据</h3>
                        <p>启动服务器后玩家数据将显示在此处</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function setPlayerTarget(name) {
    document.getElementById('playerTarget').value = name;
}

async function sendPlayerMessage() {
    const username = document.getElementById('playerTarget').value.trim();
    const message = document.getElementById('playerMessage').value.trim();
    if (!username || !message) {
        showToast('请输入玩家名和消息内容', 'warning');
        return;
    }

    const data = await API.post('/api/players/message', { username, message });
    if (data.result === 1) {
        showToast('消息已发送', 'success');
        document.getElementById('playerMessage').value = '';
    } else {
        showToast(data.message || '发送失败', 'error');
    }
}

async function kickPlayer(name) {
    const username = name || document.getElementById('playerTarget').value.trim();
    const reason = document.getElementById('kickReason')?.value.trim() || '';
    if (!username) {
        showToast('请选择玩家', 'warning');
        return;
    }

    if (!confirm(`确定要踢出玩家 ${username} 吗？`)) return;

    const data = await API.post('/api/players/kick', { username, reason });
    if (data.result === 1) {
        showToast(`已踢出 ${username}`, 'success');
    } else {
        showToast(data.message || '踢出失败', 'error');
    }
}

async function banPlayer() {
    const username = document.getElementById('playerTarget').value.trim();
    const reason = document.getElementById('banReason')?.value.trim() || '';
    if (!username) {
        showToast('请选择玩家', 'warning');
        return;
    }

    if (!confirm(`确定要封禁玩家 ${username} 吗？`)) return;

    const data = await API.post('/api/players/ban', { username, reason });
    if (data.result === 1) {
        showToast(`已封禁 ${username}`, 'success');
    } else {
        showToast(data.message || '封禁失败', 'error');
    }
}

// ============================================
// 页面: 配置文件
// ============================================
async function renderConfig() {
    const content = document.getElementById('pageContent');
    const listData = await API.get('/api/config/list');

    const files = listData.result === 1 ? listData.data : [];

    content.innerHTML = `
        <div class="page-header">
            <h2>配置文件</h2>
            <p>编辑 Project Zomboid 服务器配置文件</p>
        </div>

        <div class="alert alert-warning">
            ⚠ 修改配置文件后需重启服务器才能生效。建议修改前先创建备份。
        </div>

        <div class="card">
            <div class="card-header">
                <h3>选择配置文件</h3>
            </div>
            <div class="card-body" style="padding:0;">
                ${files.length > 0 ? `
                    <ul class="file-list">
                        ${files.map(f => `
                            <li onclick="loadConfigFile('${f.name}')">
                                <div>
                                    <div class="file-name">${f.name}</div>
                                    <div class="file-meta">${formatSize(f.size)} | ${new Date(f.modified).toLocaleString()}</div>
                                </div>
                                <span class="badge badge-info">点击编辑</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <div class="empty-state" style="padding:40px;">
                        <h3>未找到配置文件</h3>
                        <p>请确保服务器已安装并配置正确</p>
                    </div>
                `}
            </div>
        </div>

        <div class="card" id="configEditorCard" style="display:none;">
            <div class="card-header">
                <h3 id="configFileName">编辑文件</h3>
                <div>
                    <button class="btn btn-success btn-sm" onclick="saveConfigFile()">保存</button>
                </div>
            </div>
            <div class="card-body">
                <textarea class="config-editor" id="configEditor" spellcheck="false"></textarea>
            </div>
        </div>
    `;
}

let currentConfigFile = null;

async function loadConfigFile(filename) {
    currentConfigFile = filename;
    const data = await API.get(`/api/config/read?filename=${filename}`);
    
    if (data.result === 1) {
        document.getElementById('configFileName').textContent = `编辑: ${filename}`;
        document.getElementById('configEditor').value = data.data.content;
        document.getElementById('configEditorCard').style.display = 'block';
        document.getElementById('configEditorCard').scrollIntoView({ behavior: 'smooth' });
    } else {
        showToast(data.message || '加载失败', 'error');
    }
}

async function saveConfigFile() {
    if (!currentConfigFile) return;
    
    const content = document.getElementById('configEditor').value;
    const data = await API.post('/api/config/save', { filename: currentConfigFile, content });
    
    if (data.result === 1) {
        showToast('配置文件已保存 (备份已创建)', 'success');
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

// ============================================
// 页面: Mod 管理
// ============================================
async function renderMods() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/mods/list');

    const mods = data.result === 1 ? data.data.mods : [];
    const enabledCount = mods.filter(m => m.enabled).length;

    content.innerHTML = `
        <div class="page-header">
            <h2>Mod 管理</h2>
            <p>管理服务器 Mod（需重启服务器生效）</p>
        </div>

        <div class="alert alert-warning">
            ⚠ 启用/禁用 Mod 后需重启服务器才能生效。已启用: ${enabledCount}/${mods.length}
        </div>

        <div class="toolbar">
            <div class="search-box">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" id="modSearch" placeholder="搜索 Mod..." oninput="filterMods()">
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="showEnabledOnly" onchange="filterMods()">
                <span class="toggle-slider"></span>
            </label>
            <span class="text-muted">仅显示已启用</span>
        </div>

        <div class="mod-grid" id="modGrid">
            ${mods.length > 0 ? mods.map(m => `
                <div class="mod-card" data-enabled="${m.enabled}" data-name="${m.name.toLowerCase()}">
                    <div class="mod-card-header">
                        <div>
                            <div class="mod-card-title">${escapeHtml(m.name)}</div>
                            <div class="mod-card-id">${m.id || m.name}</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleMod('${m.id || m.name}', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    ${m.description ? `<div class="mod-card-desc">${escapeHtml(m.description)}</div>` : ''}
                    <div class="mod-card-footer">
                        <span class="mod-type-badge">${m.type === 'workshop' ? 'Steam 创意工坊' : '本地 Mod'}</span>
                        ${m.version ? `<span class="mod-type-badge">v${m.version}</span>` : ''}
                    </div>
                </div>
            `).join('') : `
                <div class="empty-state" style="grid-column:1/-1;">
                    <h3>未找到 Mod</h3>
                    <p>请确保 Mod 已正确安装</p>
                </div>
            `}
        </div>
    `;
}

function filterMods() {
    const search = (document.getElementById('modSearch')?.value || '').toLowerCase();
    const showEnabledOnly = document.getElementById('showEnabledOnly')?.checked || false;
    
    document.querySelectorAll('.mod-card').forEach(card => {
        const name = card.dataset.name;
        const enabled = card.dataset.enabled === 'true';
        const matchesSearch = name.includes(search);
        const matchesFilter = !showEnabledOnly || enabled;
        
        card.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

async function toggleMod(modId, enabled) {
    const endpoint = enabled ? '/api/mods/enable' : '/api/mods/disable';
    const data = await API.post(endpoint, { modIds: [modId] });
    
    if (data.result === 1) {
        showToast(`Mod ${enabled ? '已启用' : '已禁用'} (需重启生效)`, 'success');
        // Update card state
        document.querySelectorAll('.mod-card').forEach(card => {
            if (card.querySelector('.mod-card-id')?.textContent === modId) {
                card.dataset.enabled = enabled.toString();
            }
        });
    } else {
        showToast(data.message || '操作失败', 'error');
        // Revert toggle
        renderMods();
    }
}

// ============================================
// 页面: 地图 (Leaflet + PZ 瓦片 + 玩家追踪)
// ============================================
let pzMapInstance = null;
let pzMapMarkers = [];
let pzMapRefresh = null;

async function renderMap() {
    const content = document.getElementById('pageContent');
    const statusData = await API.get('/api/server/status');
    const serverName = statusData.result === 1 ? statusData.data.serverName || 'servertest' : 'servertest';

    // Stop previous refresh
    if (pzMapRefresh) { clearInterval(pzMapRefresh); pzMapRefresh = null; }

    content.innerHTML = `
        <div class="page-header">
            <h2>地图</h2>
            <p>Project Zomboid 世界地图 - ${escapeHtml(serverName)}（含在线玩家位置）</p>
        </div>

        <div class="alert alert-info">
            🌍 地图瓦片来自社区服务。玩家位置每 10 秒从服务器日志更新一次。
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            <div id="pzMapContainer" style="width:100%;height:75vh;min-height:500px;background:#0a0a1a;"></div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>坐标参考</h3>
            </div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                    <div class="stat-card" style="margin:0;">
                        <div class="stat-info">
                            <div class="stat-label">服务器</div>
                            <div class="stat-value" style="font-size:1rem;">${escapeHtml(serverName)}</div>
                        </div>
                    </div>
                    <div class="stat-card" style="margin:0;">
                        <div class="stat-info">
                            <div class="stat-label">地图</div>
                            <div class="stat-value" style="font-size:1rem;">诺克斯县 (Knox County)</div>
                        </div>
                    </div>
                    <div class="stat-card" style="margin:0;">
                        <div class="stat-info">
                            <div class="stat-label">在线玩家</div>
                            <div class="stat-value" style="font-size:1rem;" id="mapPlayerCount">-</div>
                        </div>
                    </div>
                    <div class="stat-card" style="margin:0;">
                        <div class="stat-info">
                            <div class="stat-label">操作</div>
                            <div class="stat-value" style="font-size:0.9rem;">
                                <button class="btn btn-sm btn-info" onclick="centerMapOnPlayers()">聚焦玩家</button>
                                <button class="btn btn-sm btn-secondary" onclick="openPzMapInNewTab()">打开完整地图</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load Leaflet from CDN and initialize map
    await loadLeafletCss();
    await loadLeafletScript();
    setTimeout(() => initPzMap(), 200);
}

function loadLeafletCss() {
    return new Promise((resolve) => {
        if (document.getElementById('leaflet-css')) { resolve(); return; }
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.onload = resolve;
        document.head.appendChild(link);
    });
}

function loadLeafletScript() {
    return new Promise((resolve) => {
        if (window.L) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

function initPzMap() {
    if (pzMapInstance) {
        pzMapInstance.remove();
        pzMapInstance = null;
    }

    // PZ map coordinate system:
    // World is roughly 26 cells wide x 28 cells tall
    // Each cell is 300x300 game units
    // Center of map is around cell 25, 25 in tile coords
    // We use a custom CRS that maps PZ coords to latlng

    const mapContainer = document.getElementById('pzMapContainer');
    if (!mapContainer) return;

    // Use the PZ map tile server
    const tileUrl = 'https://map.projectzomboid.com/tiles/{z}/{x}/{y}.png';

    pzMapInstance = L.map('pzMapContainer', {
        center: [0, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 6,
        zoomControl: true,
        attributionControl: false
    });

    // Add PZ tiles
    L.tileLayer(tileUrl, {
        maxZoom: 6,
        minZoom: 1,
        tileSize: 256,
        noWrap: true,
        bounds: [[-30, -30], [30, 30]]
    }).addTo(pzMapInstance);

    // Set view to center of Knox County
    pzMapInstance.setView([0, 0], 2);

    // Add player position markers
    refreshPlayerMarkers();

    // Auto-refresh every 10 seconds
    if (pzMapRefresh) clearInterval(pzMapRefresh);
    pzMapRefresh = setInterval(refreshPlayerMarkers, 10000);
}

async function refreshPlayerMarkers() {
    if (!pzMapInstance) return;

    // Use dedicated API endpoint for player positions
    const positionData = await API.get('/api/server/player-positions');
    if (positionData.result !== 1) return;

    const players = positionData.data.players || [];
    const countEl = document.getElementById('mapPlayerCount');
    if (countEl) countEl.textContent = players.length;

    // Remove old markers
    for (const m of pzMapMarkers) {
        pzMapInstance.removeLayer(m);
    }
    pzMapMarkers = [];

    // Add new markers
    for (const p of players) {
        const color = nameToColor(p.name);
        // Convert PZ game coords to map tile coords
        const lat = -(p.y / 300) * 0.8;
        const lng = (p.x / 300) * 0.8;

        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(pzMapInstance);

        marker.bindPopup(`
            <div style="color:#333;font-size:13px;">
                <strong>${escapeHtml(p.name)}</strong><br>
                坐标: ${p.x}, ${p.y}<br>
                更新时间: ${new Date(p.time).toLocaleTimeString()}
            </div>
        `);

        pzMapMarkers.push(marker);
    }
}

function nameToColor(name) {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function centerMapOnPlayers() {
    if (!pzMapInstance || pzMapMarkers.length === 0) return;
    const group = L.featureGroup(pzMapMarkers);
    pzMapInstance.fitBounds(group.getBounds().pad(0.3));
}

function openPzMapInNewTab() {
    window.open('https://map.projectzomboid.com/', '_blank');
}

// ============================================
// 页面: 日志查看
// ============================================
async function renderLogs() {
    const content = document.getElementById('pageContent');
    const logData = await API.get('/api/logs/server?count=200');
    const fileData = await API.get('/api/logs/files');

    const logs = logData.result === 1 ? logData.data : [];
    const files = fileData.result === 1 ? fileData.data.files : [];

    content.innerHTML = `
        <div class="page-header">
            <h2>日志查看</h2>
            <p>查看服务器运行日志和文件日志</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>实时日志</h3>
                <div>
                    <button class="btn btn-sm btn-secondary" onclick="renderLogs()">刷新</button>
                    <button class="btn btn-sm btn-danger" onclick="clearLogs()">清空</button>
                </div>
            </div>
            <div class="card-body" style="padding:0;">
                <div class="console-container">
                    <div class="console-output" id="logOutput" style="height:300px;">
                        ${logs.map(log => {
                            const time = new Date(log.timestamp).toLocaleTimeString();
                            let level = 'info';
                            if (log.message.includes('[ERROR]')) level = 'error';
                            else if (log.message.includes('[WARN]')) level = 'warn';
                            else if (log.message.includes('[SYSTEM]')) level = 'system';
                            return `<div class="console-line"><span class="timestamp">${time}</span><span class="level-${level}">${escapeHtml(log.message)}</span></div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>日志文件 (${files.length})</h3>
            </div>
            <div class="card-body" style="padding:0;">
                ${files.length > 0 ? `
                    <ul class="file-list">
                        ${files.slice(0, 20).map(f => `
                            <li onclick="readLogFile('${f.name}')">
                                <div>
                                    <div class="file-name">${f.name}</div>
                                    <div class="file-meta">${formatSize(f.size)} | ${new Date(f.modified).toLocaleString()}</div>
                                </div>
                                <span class="badge badge-info">查看</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <div class="empty-state" style="padding:40px;">
                        <h3>暂无日志文件</h3>
                    </div>
                `}
            </div>
        </div>
    `;

    const logOutput = document.getElementById('logOutput');
    if (logOutput) logOutput.scrollTop = logOutput.scrollHeight;
}

async function readLogFile(filename) {
    const data = await API.get(`/api/logs/read?filename=${filename}&lines=500`);
    if (data.result !== 1) {
        showToast(data.message || '读取失败', 'error');
        return;
    }

    const logData = data.data;
    showModal(
        `日志: ${filename}`,
        `<div class="console-container">
            <div class="console-output" style="height:400px;overflow-y:auto;">
                <div class="console-line"><span class="level-system">[INFO]</span> 共 ${logData.totalLines} 行，显示最后 ${logData.lines.length} 行</div>
                ${logData.lines.map(line => {
                    let level = 'info';
                    if (line.includes('[ERROR]')) level = 'error';
                    else if (line.includes('[WARN]')) level = 'warn';
                    else if (line.includes('[SYSTEM]')) level = 'system';
                    return `<div class="console-line"><span class="level-${level}">${escapeHtml(line)}</span></div>`;
                }).join('')}
            </div>
        </div>`,
        '关闭',
        () => {}
    );
}

async function clearLogs() {
    const data = await API.post('/api/logs/clear');
    if (data.result === 1) {
        showToast('日志已清空', 'success');
        renderLogs();
    }
}

// ============================================
// 页面: 备份管理
// ============================================
async function renderBackups() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/backups/list');

    const info = data.result === 1 ? data.data : { backups: [], maxBackups: 10, enabled: true };
    const backups = info.backups || [];

    content.innerHTML = `
        <div class="page-header">
            <h2>备份管理</h2>
            <p>管理服务器存档备份</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>备份操作</h3>
            </div>
            <div class="card-body">
                <div class="server-controls">
                    <button class="btn btn-primary" onclick="createBackup()">创建备份</button>
                    <label class="toggle-switch" style="margin-left:16px;">
                        <input type="checkbox" ${info.enabled ? 'checked' : ''} onchange="toggleAutoBackup(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="text-muted">自动备份 (每${info.interval || 360}分钟)</span>
                </div>
                <div class="alert alert-info mt-4">
                    📁 备份路径: ${info.backupPath || '-'}<br>
                    💾 存档路径: ${info.savesPath || '-'}<br>
                    📦 最大备份数: ${info.maxBackups || 10}
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>备份列表 (${backups.length})</h3>
            </div>
            <div class="card-body">
                ${backups.length > 0 ? `
                    <div class="backup-list">
                        ${backups.map(b => `
                            <div class="backup-item">
                                <div class="backup-info">
                                    <div class="backup-name">${escapeHtml(b.name)}</div>
                                    <div class="backup-meta">${formatSize(b.size)} | ${new Date(b.created).toLocaleString()}</div>
                                </div>
                                <div class="backup-actions">
                                    <button class="btn btn-sm btn-info" onclick="restoreBackup('${b.name}')">恢复</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteBackup('${b.name}')">删除</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        <h3>暂无备份</h3>
                        <p>点击"创建备份"按钮创建第一个备份</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

async function createBackup() {
    const data = await API.post('/api/backups/create');
    if (data.result === 1) {
        showToast('备份创建成功', 'success');
        renderBackups();
    } else {
        showToast(data.message || '创建失败', 'error');
    }
}

async function restoreBackup(name) {
    if (!confirm(`确定要从备份 "${name}" 恢复存档吗？\n\n⚠ 警告: 此操作将覆盖当前存档！\n请确保服务器已停止。`)) return;

    const data = await API.post('/api/backups/restore', { name });
    if (data.result === 1) {
        showToast('备份恢复成功', 'success');
    } else {
        showToast(data.message || '恢复失败', 'error');
    }
}

async function deleteBackup(name) {
    if (!confirm(`确定要删除备份 "${name}" 吗？`)) return;

    const data = await API.post('/api/backups/delete', { name });
    if (data.result === 1) {
        showToast('备份已删除', 'success');
        renderBackups();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

async function toggleAutoBackup(enabled) {
    const data = await API.post('/api/backups/auto', { enabled });
    if (data.result === 1) {
        showToast(`自动备份已${enabled ? '开启' : '关闭'}`, 'success');
    }
}

// ============================================
// 页面: 系统设置
// ============================================
async function renderSettings() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/config/settings');

    const settings = data.result === 1 ? data.data : {};

    content.innerHTML = `
        <div class="page-header">
            <h2>系统设置</h2>
            <p>管理面板设置和服务器路径配置</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>服务器路径设置</h3>
            </div>
            <div class="card-body">
                <div class="alert alert-warning">
                    ⚠ 修改路径后部分功能需重启面板才能生效
                </div>
                <div class="form-group">
                    <label>PZ 安装路径</label>
                    <input type="text" id="setting_installPath" value="${escapeHtml(settings.pzServer?.installPath || '')}">
                </div>
                <div class="form-group">
                    <label>服务器名</label>
                    <input type="text" id="setting_serverName" value="${escapeHtml(settings.pzServer?.serverName || 'servertest')}">
                </div>
                <div class="form-group">
                    <label>RCON 端口</label>
                    <input type="number" id="setting_rconPort" value="${settings.pzServer?.rconPort || 27015}">
                </div>
                <div class="form-group">
                    <label>管理员密码</label>
                    <input type="password" id="setting_adminPassword" placeholder="留空则不修改">
                </div>
                <div class="form-group">
                    <label>RCON 密码</label>
                    <input type="password" id="setting_rconPassword" placeholder="留空则不修改">
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>备份设置</h3>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label>自动备份</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="setting_backupEnabled" ${settings.backup?.enabled !== false ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="form-group">
                    <label>备份间隔 (分钟)</label>
                    <input type="number" id="setting_backupInterval" value="${settings.backup?.interval || 360}">
                </div>
                <div class="form-group">
                    <label>最大备份数</label>
                    <input type="number" id="setting_backupMax" value="${settings.backup?.maxBackups || 10}">
                </div>
                <div class="form-group">
                    <label>备份路径</label>
                    <input type="text" id="setting_backupPath" value="${escapeHtml(settings.backup?.path || 'backups')}">
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>账户安全</h3>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label>当前用户名</label>
                    <input type="text" value="${API.getUsername()}" disabled style="opacity:0.6;">
                </div>
                <div class="form-group">
                    <label>原密码</label>
                    <input type="password" id="setting_oldPassword" placeholder="输入原密码">
                </div>
                <div class="form-group">
                    <label>新密码</label>
                    <input type="password" id="setting_newPassword" placeholder="输入新密码">
                </div>
                <button class="btn btn-primary" onclick="saveSettings()">保存设置</button>
            </div>
        </div>
    `;
}

async function saveSettings() {
    const settings = {
        pzServer: {
            installPath: document.getElementById('setting_installPath')?.value,
            serverName: document.getElementById('setting_serverName')?.value,
            rconPort: parseInt(document.getElementById('setting_rconPort')?.value) || 27015,
            adminPassword: document.getElementById('setting_adminPassword')?.value || undefined,
            rconPassword: document.getElementById('setting_rconPassword')?.value || undefined
        },
        backup: {
            enabled: document.getElementById('setting_backupEnabled')?.checked,
            interval: parseInt(document.getElementById('setting_backupInterval')?.value) || 360,
            maxBackups: parseInt(document.getElementById('setting_backupMax')?.value) || 10,
            path: document.getElementById('setting_backupPath')?.value
        }
    };

    // Clean up empty passwords
    if (!settings.pzServer.adminPassword) delete settings.pzServer.adminPassword;
    if (!settings.pzServer.rconPassword) delete settings.pzServer.rconPassword;

    const data = await API.post('/api/config/settings', settings);
    if (data.result === 1) {
        showToast('设置已保存', 'success');
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

// ============================================
// 工具函数
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    return `${size} ${units[i]}`;
}

// ============================================
// Toast 通知
// ============================================
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-container');
    let container = existing;
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = `
            position: fixed; top: 16px; right: 16px; z-index: 2000;
            display: flex; flex-direction: column; gap: 8px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        padding: 12px 20px; border-radius: 8px; font-size: 0.85rem;
        animation: fadeInUp 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        max-width: 360px;
        display: flex; align-items: center; gap: 8px;
    `;

    const colors = {
        success: 'background: rgba(39,174,96,0.9); color: white;',
        error: 'background: rgba(231,76,60,0.9); color: white;',
        warning: 'background: rgba(243,156,18,0.9); color: white;',
        info: 'background: rgba(52,152,219,0.9); color: white;'
    };
    toast.style.cssText += colors[type] || colors.info;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    toast.innerHTML = `<span style="font-weight:bold;">${icons[type] || 'ℹ'}</span> ${escapeHtml(message)}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}