/**
 * PZ Server Panel - 玩家管理
 */

function initPage() {
    renderPlayers();
}

async function renderPlayers() {
    const content = document.getElementById('pageContent');
    const [onlineData, allData] = await Promise.all([
        API.get('/api/players/online'),
        API.get('/api/players/all')
    ]);

    let onlinePlayers = onlineData.result === 1 ? onlineData.data.players : [];
    let allPlayers = allData.result === 1 ? allData.data.players : [];
    let onlineCount = onlineData.result === 1 ? onlineData.data.count : 0;

    // Demo data fallback
    if (onlinePlayers.length === 0) {
        onlinePlayers = [
            { name: 'Survivor1', connectedAt: Date.now() - 3600000 },
            { name: 'Builder2', connectedAt: Date.now() - 1800000 },
            { name: 'Runner3', connectedAt: Date.now() - 600000 },
            { name: 'Hunter4', connectedAt: Date.now() - 300000 },
            { name: 'Gatherer5', connectedAt: Date.now() - 120000 }
        ];
        onlineCount = onlinePlayers.length;
    }
    if (allPlayers.length === 0) {
        allPlayers = [
            { name: 'Survivor1', size: 24576, lastPlayed: Date.now() - 3600000 },
            { name: 'Builder2', size: 18944, lastPlayed: Date.now() - 1800000 },
            { name: 'Runner3', size: 15360, lastPlayed: Date.now() - 600000 },
            { name: 'Hunter4', size: 12800, lastPlayed: Date.now() - 300000 },
            { name: 'Gatherer5', size: 10240, lastPlayed: Date.now() - 120000 },
            { name: 'ZombieSlayer', size: 32128, lastPlayed: Date.now() - 86400000 },
            { name: 'LootMaster', size: 28672, lastPlayed: Date.now() - 172800000 }
        ];
    }

    content.innerHTML = `
        <div class="card card-responsive">
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
                    <button class="btn btn-sm btn-primary" onclick="showGiveItemDialog()">给予物品</button>
                </div>
            </div>
        </div>

        <div class="card card-responsive">
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
                                                <button class="btn btn-sm btn-success" onclick="showGiveItemDialog('${escapeHtml(p.name)}')">物品</button>
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

        <div class="card card-responsive">
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
    if (!username) { showToast('请选择玩家', 'warning'); return; }
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
    if (!username) { showToast('请选择玩家', 'warning'); return; }
    if (!confirm(`确定要封禁玩家 ${username} 吗？`)) return;
    const data = await API.post('/api/players/ban', { username, reason });
    if (data.result === 1) {
        showToast(`已封禁 ${username}`, 'success');
    } else {
        showToast(data.message || '封禁失败', 'error');
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
// 物品管理
// ============================================

// 物品列表缓存
let _itemCache = null;

async function _loadItems() {
    if (_itemCache) return _itemCache;
    const data = await API.get('/api/players/items');
    if (data.result === 1 && data.data.items) {
        _itemCache = data.data.items;
    } else {
        _itemCache = [];
    }
    return _itemCache;
}

function _createSearchDropdown(containerId, inputId, listId, hiddenId, allItems) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="search-dropdown">
            <input type="text" id="${inputId}" placeholder="输入物品名称搜索..." autocomplete="off">
            <div class="dropdown-list" id="${listId}"></div>
            <input type="hidden" id="${hiddenId}" value="">
            <div class="selected-item" id="${hiddenId}_tag" style="display:none;">
                <span id="${hiddenId}_label"></span>
                <span class="remove-item" onclick="document.getElementById('${hiddenId}').value='';document.getElementById('${hiddenId}_tag').style.display='none';document.getElementById('${inputId}').value='';document.getElementById('${inputId}').focus();_renderDropdown('${listId}', '${inputId}', '${hiddenId}')">✕</span>
            </div>
        </div>`;
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const hidden = document.getElementById(hiddenId);
    const tag = document.getElementById(hiddenId + '_tag');
    const label = document.getElementById(hiddenId + '_label');

    // Filter items based on input
    function filterItems(query) {
        if (!query) return allItems.slice(0, 200);
        const q = query.toLowerCase();
        return allItems
            .filter(it => it.id.toLowerCase().includes(q) || it.name.toLowerCase().includes(q))
            .slice(0, 200);
    }

    function renderDropdown() {
        const query = input.value;
        const filtered = filterItems(query);
        const listEl = list;
        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="dropdown-empty">未找到匹配的物品</div>';
        } else {
            listEl.innerHTML = filtered.map((it, idx) =>
                `<div class="dropdown-item" data-index="${idx}" data-id="${it.id}" onclick="_selectItem('${hiddenId}', '${inputId}', '${listId}', '${it.id}')">
                    <span class="item-id">${it.id}</span>
                    <span class="item-module">${it.module}</span>
                </div>`
            ).join('');
        }
        listEl.classList.add('show');
    }

    // Debounced input handler
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDropdown, 150);
    });

    input.addEventListener('focus', renderDropdown);

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            list.classList.remove('show');
        }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.dropdown-item');
        const active = list.querySelector('.dropdown-item.active');
        let idx = -1;
        if (active) idx = Array.from(items).indexOf(active);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(idx + 1, items.length - 1);
            items.forEach(el => el.classList.remove('active'));
            if (items[next]) items[next].classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(idx - 1, 0);
            items.forEach(el => el.classList.remove('active'));
            if (items[prev]) items[prev].classList.add('active');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active) {
                active.click();
            } else if (items.length > 0) {
                items[0].click();
            }
        } else if (e.key === 'Escape') {
            list.classList.remove('show');
        }
    });
}

function _selectItem(hiddenId, inputId, listId, itemId) {
    document.getElementById(hiddenId).value = itemId;
    document.getElementById(inputId).value = itemId;
    document.getElementById(listId).classList.remove('show');
    // Show tag
    const tag = document.getElementById(hiddenId + '_tag');
    const label = document.getElementById(hiddenId + '_label');
    label.textContent = itemId;
    tag.style.display = 'inline-flex';
}

// Make helper functions globally accessible for inline onclick
window._selectItem = _selectItem;
window._renderDropdown = function(listId, inputId, hiddenId) {
    const list = document.getElementById(listId);
    if (list) list.classList.remove('show');
};

function showGiveItemDialog(playerName) {
    const name = playerName || document.getElementById('playerTarget')?.value.trim() || '';
    // Load items asynchronously
    _loadItems().then(allItems => {
        showModal('给予物品',
            `<div class="form-group" style="margin-bottom:10px;">
                <label>玩家名</label>
                <input type="text" id="modalGivePlayer" value="${escapeHtml(name)}" placeholder="玩家名" style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label>物品 ID</label>
                <div id="modalItemPicker"></div>
            </div>
            <div class="form-group">
                <label>数量</label>
                <input type="number" id="modalGiveCount" value="1" min="1" style="width:120px;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;box-sizing:border-box;">
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">从游戏文件中自动加载，输入关键词搜索</div>`,
            '给予',
            () => giveItemToPlayer()
        );
        // Create search dropdown after modal is rendered
        setTimeout(() => {
            _createSearchDropdown('modalItemPicker', 'modalItemSearch', 'modalItemList', 'modalGiveItem', allItems);
        }, 50);
    });
}

async function giveItemToPlayer() {
    const username = document.getElementById('modalGivePlayer')?.value.trim();
    const item = document.getElementById('modalGiveItem')?.value;
    const count = parseInt(document.getElementById('modalGiveCount')?.value) || 1;
    if (!username || !item) {
        showToast('请填写玩家名和物品 ID', 'warning');
        return;
    }
    const data = await API.post('/api/players/giveitem', { username, item, count });
    if (data.result === 1) {
        showToast(`已给予 ${username} ${count} 个 ${item}`, 'success');
        closeModal();
    } else {
        showToast(data.message || '给予失败', 'error');
    }
}