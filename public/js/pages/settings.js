/**
 * PZ Server Panel - 系统设置
 */

function initPage() { renderSettings(); }

async function renderSettings() {
    const content = document.getElementById('pageContent');

    const settingsData = await API.get('/api/config/settings');
    const savedPath = settingsData.result === 1 ? (settingsData.data.pzServer?.installPath || '') : '';

    content.innerHTML = `
        <div class="page-header">
            <h2>系统设置</h2>
            <p>游戏安装和账户管理</p>
        </div>

        <div class="flex-row">
            <div class="card flex-main" style="margin:0;flex:2;">
                <div class="card-header"><h3>游戏安装</h3></div>
                <div class="card-body">
                    <div class="form-group" style="display:flex;gap:8px;align-items:end;">
                        <div style="flex:1;">
                            <label>安装路径</label>
                            <input type="text" id="install_path" value="${escapeHtml(savedPath)}" placeholder="例如 D:\\Steam\\steamapps\\common\\ProjectZomboid" style="width:100%;">
                        </div>
                        <button class="btn btn-sm btn-info" onclick="searchInstallPaths()" id="searchBtn" style="white-space:nowrap;height:36px;">🔍 自动搜索</button>
                        <button class="btn btn-sm btn-secondary" onclick="saveInstallPath()" id="savePathBtn" style="white-space:nowrap;height:36px;">💾 保存路径</button>
                        <button class="btn btn-sm btn-primary" onclick="installPzServer()" id="installBtn" style="white-space:nowrap;height:36px;">⬇ 安装</button>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">已保存: ${escapeHtml(savedPath) || '<span style="color:var(--warning);">未配置</span>'}</div>
                    <div id="searchResult" style="margin-top:8px;display:none;"></div>
                    <div id="installProgress" style="margin-top:6px;display:none;">
                        <div class="progress-bar" style="height:6px;"><div class="progress-fill success" id="installProgressBar" style="width:0%;"></div></div>
                    </div>
                    <div class="console-container" style="margin-top:8px;">
                        <div class="console-output" id="installLogOutput" style="height:200px;font-size:0.78rem;">
                            <div class="console-line"><span class="level-system">[INFO]</span> 准备就绪，点击"安装"开始下载</div>
                        </div>
                    </div>
                    <div id="installResult" style="margin-top:6px;display:none;"></div>
                </div>
            </div>
            <div class="card flex-sidebar" style="margin:0;flex:1;">
                <div class="card-header"><h3>账户安全</h3></div>
                <div class="card-body">
                    <div class="form-group"><label>当前用户名</label><input type="text" value="${API.getUsername()}" disabled style="opacity:0.6;"></div>
                    <div class="form-group"><label>原密码</label><input type="password" id="setting_oldPassword" placeholder="输入原密码"></div>
                    <div class="form-group"><label>新密码</label><input type="password" id="setting_newPassword" placeholder="输入新密码"></div>
                    <div class="form-group"><label>确认新密码</label><input type="password" id="setting_confirmPassword" placeholder="再次输入新密码"></div>
                    <button class="btn btn-primary" onclick="changePassword()" style="width:100%;margin-top:4px;">修改密码</button>
                </div>
            </div>
        </div>
    `;
}

async function changePassword() {
    const oldPassword = document.getElementById('setting_oldPassword')?.value;
    const newPassword = document.getElementById('setting_newPassword')?.value;
    const confirmPassword = document.getElementById('setting_confirmPassword')?.value;
    if (!oldPassword || !newPassword || !confirmPassword) { showToast('请填写所有密码字段', 'warning'); return; }
    if (newPassword !== confirmPassword) { showToast('两次输入的新密码不一致', 'error'); return; }
    if (newPassword.length < 6) { showToast('新密码长度不能少于6位', 'warning'); return; }
    const key = API.getSessionKey();
    const data = await API.post('/api/change_password', { key, oldPassword, newPassword });
    if (data.result === 1) {
        showToast('密码修改成功', 'success');
        document.getElementById('setting_oldPassword').value = '';
        document.getElementById('setting_newPassword').value = '';
    } else {
        showToast(data.message || '修改失败', 'error');
    }
}

// ============================================
// 自动搜索安装路径
// ============================================
function _escJs(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function searchInstallPaths() {
    const resultDiv = document.getElementById('searchResult');
    const btn = document.getElementById('searchBtn');
    if (!resultDiv) return;

    if (btn) btn.disabled = true;
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="alert alert-info">🔍 正在扫描本地磁盘和 Steam 库，请稍候...</div>';

    const data = await API.get('/api/config/detect-pz');
    if (btn) btn.disabled = false;

    if (data.result !== 1) {
        resultDiv.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.message || '搜索失败')}</div>`;
        return;
    }

    const { found, paths } = data.data;
    if (!found || paths.length === 0) {
        resultDiv.innerHTML = `
            <div class="alert alert-warning">未找到已安装的 Project Zomboid 服务器。</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">可通过上方"安装"按钮从 Steam 下载安装，或手动填写路径。</div>`;
        return;
    }

    resultDiv.innerHTML = `
        <div class="alert alert-success" style="padding:8px 12px;font-size:0.82rem;">✅ 找到 ${paths.length} 个可能的安装路径，点击使用：</div>
        <ul class="file-list">
            ${paths.map(p => `
                <li onclick="useInstallPath('${_escJs(p.path)}')">
                    <div>
                        <div class="file-name">${escapeHtml(p.path)}</div>
                        <div class="file-meta">来源: ${escapeHtml(p.source)}</div>
                    </div>
                    <span class="badge badge-info">使用</span>
                </li>
            `).join('')}
        </ul>`;
}

async function useInstallPath(path) {
    if (!path) return;
    const input = document.getElementById('install_path');
    if (input) input.value = path;

    const data = await API.post('/api/config/settings', { pzServer: { installPath: path } });
    if (data.result === 1) {
        showToast(`已设置安装路径: ${path}`, 'success');
        const resultDiv = document.getElementById('searchResult');
        if (resultDiv) resultDiv.style.display = 'none';
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

async function saveInstallPath() {
    const input = document.getElementById('install_path');
    const installPath = input?.value.trim();
    if (!installPath) { showToast('请输入安装路径', 'warning'); return; }
    const data = await API.post('/api/config/settings', { pzServer: { installPath } });
    if (data.result === 1) {
        showToast('安装路径已保存', 'success');
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

// ============================================
// 游戏安装
// ============================================
async function installPzServer() {
    const pathInput = document.getElementById('install_path');
    const installPath = pathInput?.value.trim();
    if (!installPath) { showToast('请填写安装路径', 'warning'); return; }

    const btn = document.getElementById('installBtn');
    const progress = document.getElementById('installProgress');
    const bar = document.getElementById('installProgressBar');
    const logOutput = document.getElementById('installLogOutput');
    const result = document.getElementById('installResult');

    function appendLog(level, msg) {
        if (!logOutput) return;
        const time = new Date().toLocaleTimeString();
        const levelClass = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'system';
        logOutput.innerHTML += `<div class="console-line"><span class="timestamp">${time}</span><span class="level-${levelClass}">${escapeHtml(msg)}</span></div>`;
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    btn.disabled = true;
    btn.textContent = '⏳ 安装中...';
    progress.style.display = 'block';
    result.style.display = 'none';
    bar.style.width = '0%';
    logOutput.innerHTML = '';
    appendLog('info', '正在启动安装进程...');

    // Start installation via API
    const resp = await API.post('/api/config/install-pz', { installPath });

    if (resp.result !== 1) {
        appendLog('error', resp.message || '启动安装失败');
        btn.disabled = false;
        btn.textContent = '⬇ 安装';
        return;
    }

    appendLog('info', '安装已启动，正在获取实时日志...');

    // Poll for real-time logs every 2 seconds
    let pollCount = 0;
    const pollTimer = setInterval(async () => {
        const status = await API.get('/api/config/install-status');
        if (status.result === 1 && status.data) {
            for (const line of status.data.logs || []) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const level = trimmed.includes('[ERROR]') ? 'error' : trimmed.includes('[WARN]') ? 'warn' : 'info';
                const lastLine = logOutput.lastElementChild?.textContent;
                if (!lastLine || !lastLine.includes(trimmed)) {
                    appendLog(level, trimmed.replace(/\[(INFO|ERROR|WARN|SUCCESS)\]\s*/g, ''));
                }
            }
            // Update progress bar based on log content
            const allLogs = logOutput.textContent || '';
            if (allLogs.includes('安装完成')) bar.style.width = '100%';
            else if (allLogs.includes('正在验证')) bar.style.width = '85%';
            else if (allLogs.includes('正在下载 Project Zomboid')) bar.style.width = '40%';
            else if (allLogs.includes('正在连接 Steam')) bar.style.width = '30%';
            else if (allLogs.includes('SteamCMD 准备就绪')) bar.style.width = '25%';
            else if (allLogs.includes('正在下载 SteamCMD')) bar.style.width = '15%';
            else if (pollCount > 2) bar.style.width = Math.min(parseInt(bar.style.width || '0') + 2, 90) + '%';

            if (status.data.done) {
                clearInterval(pollTimer);
                bar.style.width = '100%';
                btn.disabled = false;
                btn.textContent = '⬇ 安装';
                result.innerHTML = status.data.logs?.some(l => l.includes('[ERROR]'))
                    ? `<div class="alert alert-danger" style="font-size:0.82rem;padding:8px 12px;">安装过程中出现错误，请查看日志</div>`
                    : `<div class="alert alert-success" style="font-size:0.82rem;padding:8px 12px;">安装完成！</div>`;
                result.style.display = 'block';
            }
        }
        pollCount++;
    }, 2000);
}