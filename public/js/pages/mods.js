/**
 * PZ Server Panel - Mod 管理
 */

function initPage() { renderMods(); }

async function renderMods() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/mods/list');
    let mods = data.result === 1 ? data.data.mods : [];
    let enabledCount = mods.filter(m => m.enabled).length;

    // Demo mods fallback
    if (mods.length === 0) {
        mods = [
            { id: '2526740891', name: 'Brita\'s Weapon Pack', enabled: true, type: 'workshop', description: '添加大量现代武器、弹药和配件', version: '3.4' },
            { id: '2675952220', name: 'Autotsar Trailers', enabled: true, type: 'workshop', description: '添加可拖拽的拖车系统', version: '2.1' },
            { id: '2660798535', name: 'Map Symbol Framework', enabled: true, type: 'workshop', description: '地图标记框架', version: '1.0' },
            { id: '2689014815', name: 'Easy Config Chucked', enabled: false, type: 'workshop', description: '简化配置修改', version: '1.2' },
            { id: '2701894563', name: 'Filibuster Rhymes\' Used Cars', enabled: false, type: 'workshop', description: '更多车辆和车辆配件', version: '2.0' },
            { id: '2721324568', name: 'Better Sorting', enabled: true, type: 'workshop', description: '改进物品分类界面', version: '1.5' },
        ];
        enabledCount = mods.filter(m => m.enabled).length;
    }

    content.innerHTML = `
        <div class="alert alert-warning">⚠ 启用/禁用 Mod 后需重启服务器才能生效。已启用: ${enabledCount}/${mods.length}</div>
        <div class="card card-responsive">
            <div class="card-header"><h3>从 Steam 创意工坊添加 Mod</h3></div>
            <div class="card-body">
                <div class="inline-form">
                    <input type="text" id="workshopUrl" placeholder="创意工坊 URL 或 Mod ID（如 1234567890）" style="flex:1;min-width:200px;">
                    <button class="btn btn-primary btn-sm" onclick="addWorkshopMod()">添加</button>
                    <button class="btn btn-sm btn-secondary" onclick="refreshWorkshopList()">查看已安装</button>
                </div>
                <div id="workshopResult" style="margin-top:8px;display:none;"></div>
            </div>
        </div>
        <div class="toolbar">
            <div class="search-box">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="modSearch" placeholder="搜索 Mod..." oninput="filterMods()">
            </div>
            <label class="toggle-switch"><input type="checkbox" id="showEnabledOnly" onchange="filterMods()"><span class="toggle-slider"></span></label>
            <span class="text-muted">仅显示已启用</span>
        </div>
        <div class="mod-grid" id="modGrid">
            ${mods.length > 0 ? mods.map(m => `
                <div class="mod-card" data-enabled="${m.enabled}" data-name="${m.name.toLowerCase()}">
                    <div class="mod-card-header">
                        <div><div class="mod-card-title">${escapeHtml(m.name)}</div><div class="mod-card-id">${m.id || m.name}</div></div>
                        <label class="toggle-switch"><input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleMod('${m.id || m.name}', this.checked)"><span class="toggle-slider"></span></label>
                    </div>
                    ${m.description ? `<div class="mod-card-desc">${escapeHtml(m.description)}</div>` : ''}
                    <div class="mod-card-footer"><span class="mod-type-badge">${m.type === 'workshop' ? 'Steam 创意工坊' : '本地 Mod'}</span>${m.version ? `<span class="mod-type-badge">v${m.version}</span>` : ''}</div>
                </div>
            `).join('') : `<div class="empty-state" style="grid-column:1/-1;"><h3>未找到 Mod</h3><p>请确保 Mod 已正确安装，或通过上方创意工坊添加</p></div>`}
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
        document.querySelectorAll('.mod-card').forEach(card => { if (card.querySelector('.mod-card-id')?.textContent === modId) card.dataset.enabled = enabled.toString(); });
    } else { showToast(data.message || '操作失败', 'error'); renderMods(); }
}

async function addWorkshopMod() {
    const input = document.getElementById('workshopUrl');
    const resultDiv = document.getElementById('workshopResult');
    const url = input.value.trim();
    if (!url) { showToast('请输入创意工坊 URL 或 Mod ID', 'warning'); return; }
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="alert alert-info">正在添加...</div>';
    const data = await API.post('/api/mods/workshop/add', { url });
    if (data.result === 1) { resultDiv.innerHTML = `<div class="alert alert-success">${data.message}</div>`; input.value = ''; renderMods(); }
    else resultDiv.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
}

async function refreshWorkshopList() {
    const resultDiv = document.getElementById('workshopResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="alert alert-info">正在获取...</div>';
    const data = await API.get('/api/mods/workshop/list');
    if (data.result !== 1) { resultDiv.innerHTML = `<div class="alert alert-danger">${data.message}</div>`; return; }
    const { configuredInServer, installed, workshopPath } = data.data;
    let html = '<div class="card" style="margin:0;"><div class="card-header"><h3>已配置的 Workshop Mod</h3></div><div class="card-body" style="padding:0;">';
    if (configuredInServer.length > 0) {
        html += '<ul class="file-list">';
        for (const id of configuredInServer) {
            html += `<li><div><div class="file-name">Steam Workshop ID: ${id}</div></div><button class="btn btn-sm btn-danger" onclick="removeWorkshopMod('${id}')">移除</button></li>`;
        }
        html += '</ul>';
    } else html += '<div class="empty-state" style="padding:30px;"><h3>未配置 Workshop Mod</h3></div>';
    html += '</div></div>';
    if (installed.length > 0) {
        html += '<div class="card" style="margin:8px 0 0;"><div class="card-header"><h3>已下载的 Mod 文件</h3></div><div class="card-body" style="padding:0;"><ul class="file-list">';
        for (const item of installed) html += `<li><div><div class="file-name">${item.id}</div><div class="file-meta">${item.inConfig ? '已在配置中' : '未在配置中'}</div></div></li>`;
        html += '</ul></div></div>';
    }
    html += `<div class="alert alert-info" style="margin-top:8px;">Workshop 路径: ${workshopPath}</div>`;
    resultDiv.innerHTML = html;
}

async function removeWorkshopMod(id) {
    if (!confirm(`确定要从服务器配置中移除 Workshop Mod [${id}] 吗？`)) return;
    const data = await API.post('/api/mods/workshop/remove', { workshopId: id });
    if (data.result === 1) { showToast(data.message, 'success'); refreshWorkshopList(); renderMods(); }
    else showToast(data.message || '移除失败', 'error');
}