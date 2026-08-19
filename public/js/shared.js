/**
 * PZ Server Panel - 共享脚本
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
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const separator = url.includes('?') ? '&' : '?';
        const urlWithKey = `${url}${separator}key=${this.getSessionKey()}`;
        try {
            const response = await fetch(urlWithKey, options);
            return await response.json();
        } catch (err) {
            console.error('API请求失败:', err);
            return { result: 0, message: '网络错误' };
        }
    },
    get(url) { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); }
};

// ============================================
// 通用工具函数
// ============================================
function formatUptime(seconds) {
    if (!seconds) return '0秒';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}时${m}分`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(1) + ' ' + units[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer') || (() => {
        const el = document.createElement('div');
        el.id = 'toastContainer';
        el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(el);
        return el;
    })();
    const toast = document.createElement('div');
    toast.style.cssText = `padding:12px 20px;border-radius:8px;font-size:0.85rem;animation:slideIn 0.3s ease;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.15);${
        type === 'success' ? 'background:#00b894;color:#fff;' :
        type === 'error' ? 'background:#e17055;color:#fff;' :
        type === 'warning' ? 'background:#fdcb6e;color:#2d3436;' :
        'background:#74b9ff;color:#fff;'
    }`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
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
    if (modalCallback) modalCallback();
    closeModal();
}

// ============================================
// 登出
// ============================================
function logout() {
    sessionStorage.removeItem('sessionKey');
    sessionStorage.removeItem('username');
    window.location.href = '/login';
}

// ============================================
// 侧边栏切换
// ============================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ============================================
// 页面初始化
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const sessionKey = API.getSessionKey();
    if (!sessionKey) { window.location.href = '/login'; return; }
    API.get('/api/check_session').then(data => {
        if (data.result !== 1) { window.location.href = '/login'; return; }
        const username = API.getUsername();
        const nameEl = document.getElementById('userName');
        const avatarEl = document.getElementById('userAvatar');
        if (nameEl) nameEl.textContent = username;
        if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
        startStatusCheck();
        if (typeof initPage === 'function') initPage();
    });
});

// ============================================
// 服务器状态检查
// ============================================
let statusCheckInterval = null;

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
            text.textContent = `运行中 (${formatUptime(status.uptime)})`;
        } else {
            dot.className = 'status-dot offline';
            text.textContent = '已停止';
        }
        // Update power buttons state
        updatePowerButtons(status.running);
    }
}

// ============================================
// 电源管理（服务器启停）
// ============================================
function updatePowerButtons(running) {
    const startBtn = document.getElementById('powerStart');
    const stopBtn = document.getElementById('powerStop');
    const restartBtn = document.getElementById('powerRestart');
    if (startBtn) startBtn.disabled = running;
    if (stopBtn) stopBtn.disabled = !running;
    if (restartBtn) restartBtn.disabled = !running;
    // Also update console status if present
    const conDot = document.getElementById('consoleStatusDot');
    const conText = document.getElementById('consoleStatusText');
    if (conDot) conDot.className = 'status-dot ' + (running ? 'online' : 'offline');
    if (conText) conText.textContent = running ? '运行中' : '已停止';
}

async function startServer() {
    const btn = document.getElementById('powerStart');
    if (btn) btn.disabled = true;
    const data = await API.post('/api/server/start');
    if (data.result === 1) {
        showToast('服务器启动成功', 'success');
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
    } else {
        showToast(data.message || '停止失败', 'error');
    }
}

async function restartServer() {
    if (!confirm('确定要重启服务器吗？所有在线玩家将被断开连接。')) return;
    const btn = document.getElementById('powerRestart');
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