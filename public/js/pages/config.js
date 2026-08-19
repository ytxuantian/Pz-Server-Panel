/**
 * PZ Server Panel - 配置文件
 */

let currentConfigFile = null;
let currentVisualConfig = [];
let configCache = {};
let searchFilter = '';
let categoryCollapsed = {};
let configFieldIds = {};
let categoryEls = {};

const CONFIG_CATEGORY_ORDER = ['基本设置', '网络设置', '游戏设置', '僵尸设置', '战利品设置', 'PVP 设置', '经济设置', '管理设置', '其他'];
const CONFIG_CATEGORY_ICONS = {
    '基本设置': '🏠',
    '网络设置': '🌐',
    '游戏设置': '🎮',
    '僵尸设置': '🧟',
    '战利品设置': '📦',
    'PVP 设置': '⚔️',
    '经济设置': '💰',
    '管理设置': '🔧',
    '其他': '📋'
};

function initPage() {
    renderConfig();
}

function escAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
}

async function renderConfig() {
    const content = document.getElementById('pageContent');
    const listData = await API.get('/api/config/list');
    const files = listData.result === 1 ? listData.data : [];

    content.innerHTML = `
        <div class="alert alert-warning">⚠ 修改配置文件后需重启服务器才能生效。建议修改前先创建备份。</div>

        <div class="config-toolbar">
            <div class="config-file-selector">
                <label>📄 选择文件：</label>
                <select id="configFileSelect" onchange="onConfigFileChange()">
                    ${files.map(f => `<option value="${escapeHtml(f.name)}">${escapeHtml(f.name)}</option>`).join('')}
                </select>
            </div>
            <div class="config-actions">
                <button class="btn btn-secondary btn-sm" onclick="showRawEditor()">📝 文本编辑</button>
                <button class="btn btn-success" onclick="saveVisualConfig()">💾 保存修改</button>
            </div>
        </div>

        <div class="config-search-bar">
            <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="configSearch" placeholder="搜索设置项（名称 / 键名 / 描述）..." autocomplete="off" oninput="onSearchConfig(this.value)">
            <button class="search-clear" id="configSearchClear" onclick="clearConfigSearch()" title="清空搜索">✕</button>
        </div>

        <div id="visualConfigContainer">
            <div class="page-loading" style="padding:40px;">
                <svg class="spinner" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>
                <span>加载配置...</span>
            </div>
        </div>

        <div class="card" id="configEditorCard" style="display:none;">
            <div class="card-header">
                <h3 id="configEditorName">文本编辑</h3>
                <div>
                    <button class="btn btn-secondary btn-sm" onclick="backToVisual()">🎨 返回可视化</button>
                    <button class="btn btn-success btn-sm" onclick="saveRawConfig()">💾 保存</button>
                </div>
            </div>
            <div class="card-body">
                <textarea class="config-editor" id="configEditor" spellcheck="false"></textarea>
            </div>
        </div>
    `;

    if (files.length > 0) {
        loadVisualConfig(files[0].name);
    } else {
        document.getElementById('visualConfigContainer').innerHTML = `
            <div class="empty-state" style="padding:40px;">
                <h3>未找到配置文件</h3>
                <p>请确认 PZ 服务器安装路径下存在 media/config/*.ini</p>
            </div>`;
    }
}

function onConfigFileChange() {
    const sel = document.getElementById('configFileSelect');
    if (!sel || !sel.value) return;
    const editorCard = document.getElementById('configEditorCard');
    if (editorCard) editorCard.style.display = 'none';
    const container = document.getElementById('visualConfigContainer');
    if (container) container.style.display = '';
    loadVisualConfig(sel.value);
}

// ============================================
// 可视化编辑器
// ============================================
async function loadVisualConfig(filename) {
    currentConfigFile = filename;

    const sel = document.getElementById('configFileSelect');
    if (sel) sel.value = filename;

    const editorCard = document.getElementById('configEditorCard');
    if (editorCard) editorCard.style.display = 'none';

    const searchInput = document.getElementById('configSearch');
    if (searchInput) searchInput.value = '';
    searchFilter = '';
    const clearBtn = document.getElementById('configSearchClear');
    if (clearBtn) clearBtn.classList.remove('visible');

    const container = document.getElementById('visualConfigContainer');
    if (container) {
        container.style.display = '';
        container.innerHTML = '<div class="page-loading" style="padding:40px;"><svg class="spinner" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg><span>加载配置...</span></div>';
    }

    let data = configCache[filename];
    if (!data) {
        const res = await API.get(`/api/config/visual?filename=${encodeURIComponent(filename)}`);
        if (res.result !== 1) {
            showToast('无法加载可视化配置，已切换到文本编辑', 'warning');
            await showRawEditor();
            return;
        }
        data = res.data;
        configCache[filename] = data;
    }

    currentVisualConfig = [];
    configFieldIds = {};

    const categories = data.categories || {};
    for (const [cat, fields] of Object.entries(categories)) {
        for (const field of fields) {
            const id = `cfg_${currentVisualConfig.length}`;
            field.id = id;
            field.category = cat;
            field.original = field.value || '';
            currentVisualConfig.push(field);
            if (!configFieldIds[field.key]) configFieldIds[field.key] = [];
            configFieldIds[field.key].push(id);
        }
    }

    renderVisualConfig();
    container.scrollIntoView({ behavior: 'smooth' });
}

function renderVisualConfig() {
    const container = document.getElementById('visualConfigContainer');
    if (!container) return;

    snapshotValues();

    if (currentVisualConfig.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:40px;"><h3>该文件没有可编辑的设置项</h3><p>请切换到文本编辑模式修改</p></div>`;
        return;
    }

    const search = (searchFilter || '').trim().toLowerCase();
    const searching = search.length > 0;

    const byCategory = {};
    for (const field of currentVisualConfig) {
        if (searching) {
            const label = field.meta.label || field.key;
            const hay = `${label} ${field.key} ${field.meta.desc || ''}`.toLowerCase();
            if (!hay.includes(search)) continue;
        }
        if (!byCategory[field.category]) byCategory[field.category] = [];
        byCategory[field.category].push(field);
    }

    const orderedCategories = [
        ...CONFIG_CATEGORY_ORDER.filter(c => byCategory[c] && byCategory[c].length > 0),
        ...Object.keys(byCategory).filter(c => !CONFIG_CATEGORY_ORDER.includes(c))
    ];

    if (orderedCategories.length === 0) {
        container.innerHTML = `
            <div class="config-empty-filter">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <h3>未找到匹配的设置项</h3>
                <p>请尝试更换搜索关键词</p>
            </div>`;
        return;
    }

    categoryEls = {};
    let html = '';

    orderedCategories.forEach((cat, idx) => {
        const fields = byCategory[cat];
        categoryEls[idx] = cat;
        const icon = CONFIG_CATEGORY_ICONS[cat] || '📋';
        const configCount = fields.filter(f => !f.notInFile).length;
        const unsetCount = fields.filter(f => f.notInFile).length;
        const collapsed = !!categoryCollapsed[cat] && !searching;

        html += `
        <div class="config-category-card card">
            <div class="card-header" onclick="toggleCategory(${idx})">
                <h3>${icon} ${escapeHtml(cat)}</h3>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="card-header-badges">
                        <span class="badge badge-info">${configCount} 项</span>
                        ${unsetCount > 0 ? `<span class="badge badge-warning">${unsetCount} 项未配置</span>` : ''}
                    </div>
                    <span class="collapse-icon ${collapsed ? 'collapsed' : ''}" id="catIcon_${idx}">▼</span>
                </div>
            </div>
            <div class="card-body ${collapsed ? 'collapsed' : ''}" id="catBody_${idx}">
                <div class="visual-config-grid">
                    ${fields.map(field => renderConfigFieldHtml(field)).join('')}
                </div>
            </div>
        </div>`;
    });

    html += `
        <div class="config-save-bar">
            <span style="font-size:0.85rem;color:var(--text-muted);" id="configModifiedCount">无未保存修改</span>
            <div style="margin-left:auto;display:flex;gap:10px;">
                <button class="btn btn-secondary btn-sm" onclick="showRawEditor()">📝 文本编辑</button>
                <button class="btn btn-success" onclick="saveVisualConfig()">💾 保存修改</button>
            </div>
        </div>`;

    container.innerHTML = html;
    updateModifiedState();
}

function renderConfigFieldHtml(field) {
    const m = field.meta;
    const notInFile = !!field.notInFile;
    return `
        <div class="config-field ${notInFile ? 'field-not-in-file' : ''}">
            <div class="field-header">
                <div>
                    <div class="field-label">
                        ${escapeHtml(m.label || field.key)}
                        ${notInFile ? '<span class="badge badge-warning badge-sm">未配置</span>' : ''}
                    </div>
                    ${m.desc ? `<div class="field-desc">${escapeHtml(m.desc)}</div>` : ''}
                </div>
                <button class="field-reset" onclick="resetConfigField('${field.key}')" title="重置为原始值">↺ 重置</button>
            </div>
            <div class="field-control">
                ${renderConfigField(field.id, m, field.value, field.key)}
            </div>
        </div>`;
}

function renderConfigField(id, meta, value, key) {
    const val = value || '';
    switch (meta.type) {
        case 'toggle': {
            const checked = val === 'true' ? 'checked' : '';
            return `<label class="toggle-switch">
                <input type="checkbox" id="${id}" ${checked} onchange="markConfigModified('${key}')">
                <span class="toggle-slider"></span>
            </label>`;
        }
        case 'number': {
            const min = meta.min !== undefined ? `min="${meta.min}"` : '';
            const max = meta.max !== undefined ? `max="${meta.max}"` : '';
            const step = meta.step !== undefined ? `step="${meta.step}"` : '';
            return `<input type="number" id="${id}" value="${escAttr(val)}" ${min} ${max} ${step} oninput="markConfigModified('${key}')">`;
        }
        case 'select': {
            const opts = (meta.options || []).map(o =>
                `<option value="${escAttr(o.value)}" ${String(val) === String(o.value) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
            ).join('');
            return `<select id="${id}" onchange="markConfigModified('${key}')">${opts}</select>`;
        }
        case 'textarea':
            return `<textarea id="${id}" oninput="markConfigModified('${key}')">${escapeHtml(val)}</textarea>`;
        case 'password':
            return `<input type="password" id="${id}" value="${escAttr(val)}" oninput="markConfigModified('${key}')">`;
        default:
            return `<input type="text" id="${id}" value="${escAttr(val)}" oninput="markConfigModified('${key}')">`;
    }
}

// ============================================
// 修改跟踪 / 重置
// ============================================
function snapshotValues() {
    for (const field of currentVisualConfig) {
        const input = document.getElementById(field.id);
        if (!input) continue;
        field.value = field.meta.type === 'toggle' ? (input.checked ? 'true' : 'false') : input.value;
    }
}

function markConfigModified(key) {
    for (const id of configFieldIds[key] || []) {
        const field = currentVisualConfig.find(f => f.id === id);
        const input = document.getElementById(id);
        if (field && input) {
            field.value = field.meta.type === 'toggle' ? (input.checked ? 'true' : 'false') : input.value;
        }
    }
    updateModifiedState();
}

function resetConfigField(key) {
    for (const id of configFieldIds[key] || []) {
        const field = currentVisualConfig.find(f => f.id === id);
        const input = document.getElementById(id);
        if (!field || !input) continue;
        field.value = field.original;
        if (field.meta.type === 'toggle') {
            input.checked = field.original === 'true';
        } else {
            input.value = field.original;
        }
    }
    updateModifiedState();
}

function updateModifiedState() {
    let count = 0;
    for (const field of currentVisualConfig) {
        const modified = field.value !== field.original;
        if (modified) count++;
        const input = document.getElementById(field.id);
        if (!input) continue;
        const fieldEl = input.closest('.config-field');
        if (fieldEl) fieldEl.classList.toggle('field-modified', modified);
        const resetBtn = fieldEl ? fieldEl.querySelector('.field-reset') : null;
        if (resetBtn) resetBtn.classList.toggle('visible', modified);
    }
    const countEl = document.getElementById('configModifiedCount');
    if (countEl) countEl.textContent = count > 0 ? `已修改 ${count} 项` : '无未保存修改';
}

// ============================================
// 搜索 / 折叠
// ============================================
function onSearchConfig(value) {
    searchFilter = value || '';
    const clearBtn = document.getElementById('configSearchClear');
    if (clearBtn) clearBtn.classList.toggle('visible', searchFilter.length > 0);
    renderVisualConfig();
}

function clearConfigSearch() {
    searchFilter = '';
    const input = document.getElementById('configSearch');
    if (input) input.value = '';
    const clearBtn = document.getElementById('configSearchClear');
    if (clearBtn) clearBtn.classList.remove('visible');
    renderVisualConfig();
}

function toggleCategory(idx) {
    const cat = categoryEls[idx];
    if (!cat) return;
    categoryCollapsed[cat] = !categoryCollapsed[cat];
    const body = document.getElementById(`catBody_${idx}`);
    const icon = document.getElementById(`catIcon_${idx}`);
    if (body) body.classList.toggle('collapsed', categoryCollapsed[cat]);
    if (icon) icon.classList.toggle('collapsed', categoryCollapsed[cat]);
}

// ============================================
// 保存
// ============================================
async function saveVisualConfig() {
    if (!currentConfigFile) return;

    snapshotValues();

    const settings = [];
    for (const field of currentVisualConfig) {
        if (field.value !== field.original) {
            settings.push({ key: field.key, value: field.value });
        }
    }

    if (settings.length === 0) {
        showToast('没有需要保存的修改', 'info');
        return;
    }

    const data = await API.post('/api/config/visual/save', {
        filename: currentConfigFile,
        settings
    });

    if (data.result === 1) {
        showToast(`配置已保存 (${settings.length} 项修改)`, 'success');
        delete configCache[currentConfigFile];
        await loadVisualConfig(currentConfigFile);
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

// ============================================
// 文本编辑
// ============================================
async function showRawEditor() {
    if (!currentConfigFile) return;

    const container = document.getElementById('visualConfigContainer');
    const editorCard = document.getElementById('configEditorCard');
    const editor = document.getElementById('configEditor');

    let data;
    if (configCache[currentConfigFile]) {
        data = { result: 1, data: { content: configCache[currentConfigFile].raw || '' } };
    } else {
        data = await API.get(`/api/config/read?filename=${encodeURIComponent(currentConfigFile)}`);
    }

    if (data.result !== 1) {
        showToast(data.message || '加载失败', 'error');
        return;
    }

    editor.value = data.data.content;
    document.getElementById('configEditorName').textContent = `编辑: ${currentConfigFile}（文本模式）`;
    if (container) container.style.display = 'none';
    editorCard.style.display = 'block';
    editorCard.scrollIntoView({ behavior: 'smooth' });
}

function backToVisual() {
    if (!currentConfigFile) return;
    const container = document.getElementById('visualConfigContainer');
    const editorCard = document.getElementById('configEditorCard');
    if (container) container.style.display = '';
    if (editorCard) editorCard.style.display = 'none';
    loadVisualConfig(currentConfigFile);
}

async function saveRawConfig() {
    if (!currentConfigFile) return;
    const content = document.getElementById('configEditor').value;
    const data = await API.post('/api/config/save', { filename: currentConfigFile, content });
    if (data.result === 1) {
        showToast('配置文件已保存', 'success');
        delete configCache[currentConfigFile];
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}
