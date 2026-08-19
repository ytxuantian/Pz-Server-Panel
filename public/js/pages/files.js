/**
 * PZ Server Panel - 文件管理
 */

let currentDir = '';
let currentFile = null;

function initPage() { renderFiles(); }

function escJs(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function fileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const icons = {
        ini: '⚙️', cfg: '⚙️', conf: '⚙️', json: '📋', xml: '📋', yaml: '📋', yml: '📋',
        txt: '📄', log: '📄', md: '📄', csv: '📊',
        bat: '🖥️', sh: '🖥️', exe: '🖥️',
        zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️',
        png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', bmp: '🖼️',
        jar: '📦', mod: '📦', lua: '🧩', java: '🧩'
    };
    return icons[ext] || '📄';
}

async function renderFiles() {
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="page-loading"><svg class="spinner" viewBox="0 0 24 24" width="32" height="32"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg><span>加载中...</span></div>';

    const data = await API.get('/api/files/list?path=' + encodeURIComponent(currentDir));
    if (data.result !== 1) {
        content.innerHTML = `
            <div class="card card-responsive">
                <div class="card-body">
                    <div class="alert alert-danger">${escapeHtml(data.message || '加载失败')}</div>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin-top:8px;">
                        请在 <a href="settings.html">系统设置</a> 中配置 PZ 安装路径后使用。
                    </p>
                </div>
            </div>`;
        return;
    }

    currentDir = data.data.current || '';
    const entries = data.data.entries || [];

    const segments = currentDir ? currentDir.split('/') : [];
    let crumbHtml = '<a href="javascript:void(0)" onclick="gotoDir(\'\')">根目录</a>';
    let acc = '';
    segments.forEach((seg) => {
        acc = acc ? acc + '/' + seg : seg;
        crumbHtml += ` / <a href="javascript:void(0)" onclick="gotoDir('${escJs(acc)}')">${escapeHtml(seg)}</a>`;
    });

    content.innerHTML = `
        <div class="alert alert-info">📁 服务器文件管理 — 仅限访问 PZ 安装目录。修改服务器文件后需重启服务器生效。</div>
        <div class="card card-responsive">
            <div class="card-header">
                <h3>📂 ${escapeHtml(data.data.root)}</h3>
                <span class="badge badge-info">${entries.length} 项</span>
            </div>
            <div class="card-body" style="padding:0;">
                <div class="path-bar">
                    <div class="breadcrumb">${crumbHtml}</div>
                    <div class="file-actions">
                        <button class="btn btn-secondary btn-sm" onclick="goUp()" ${currentDir ? '' : 'disabled'}>⬆ 上一级</button>
                        <button class="btn btn-secondary btn-sm" onclick="renderFiles()">🔄 刷新</button>
                        <button class="btn btn-info btn-sm" onclick="showMkdirModal()">📁 新建文件夹</button>
                        <button class="btn btn-primary btn-sm" onclick="showUploadDialog()">⬆ 上传文件</button>
                    </div>
                </div>
                <input type="file" id="fileUploadInput" style="display:none;" multiple>
                ${entries.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr><th>名称</th><th>类型</th><th>大小</th><th>修改时间</th><th>操作</th></tr>
                            </thead>
                            <tbody>
                                ${entries.map(renderFileRow).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state" style="padding:40px;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <h3>空目录</h3>
                    </div>
                `}
            </div>
        </div>
    `;

    initUploadListener();
}

function renderFileRow(e) {
    const isDir = e.type === 'dir';
    const icon = fileIcon(e.name);
    const name = isDir
        ? `<a href="javascript:void(0)" onclick="gotoDir('${escJs(e.path)}')" style="font-weight:500;">${icon} ${escapeHtml(e.name)}</a>`
        : `<span>${icon} ${escapeHtml(e.name)}</span>`;

    const actions = [];
    if (isDir) {
        actions.push(`<button class="btn btn-sm btn-info" onclick="gotoDir('${escJs(e.path)}')">打开</button>`);
        actions.push(`<button class="btn btn-sm btn-danger" onclick="deleteEntry('${escJs(e.path)}', true)">删除</button>`);
    } else {
        if (e.viewable) {
            actions.push(`<button class="btn btn-sm btn-secondary" onclick="viewFile('${escJs(e.path)}')">查看</button>`);
        }
        actions.push(`<button class="btn btn-sm btn-info" onclick="downloadFile('${escJs(e.path)}')">下载</button>`);
        actions.push(`<button class="btn btn-sm btn-danger" onclick="deleteEntry('${escJs(e.path)}', false)">删除</button>`);
    }

    return `
        <tr>
            <td>${name}</td>
            <td>${isDir ? '<span class="badge badge-info">目录</span>' : '<span class="badge badge-warning">文件</span>'}</td>
            <td>${isDir ? '-' : formatSize(e.size)}</td>
            <td>${new Date(e.modified).toLocaleString()}</td>
            <td><div class="action-btns">${actions.join('')}</div></td>
        </tr>`;
}

// ============================================
// 导航
// ============================================
function gotoDir(relPath) {
    currentDir = relPath;
    renderFiles();
}

function goUp() {
    if (!currentDir) return;
    const idx = currentDir.lastIndexOf('/');
    currentDir = idx === -1 ? '' : currentDir.slice(0, idx);
    renderFiles();
}

// ============================================
// 查看 / 编辑
// ============================================
async function viewFile(relPath) {
    const data = await API.get('/api/files/read?path=' + encodeURIComponent(relPath));
    if (data.result !== 1) {
        showToast(data.message || '读取失败', 'error');
        return;
    }
    const info = data.data;
    currentFile = relPath;
    showModal(`编辑: ${info.path.split('/').pop()}`,
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <div style="font-size:0.78rem;color:var(--text-muted);">${formatSize(info.size)} · ${new Date(info.modified).toLocaleString()}</div>
            <span class="badge badge-warning">文本编辑</span>
        </div>
        <textarea id="fileEditor" class="config-editor" spellcheck="false"></textarea>`,
        '保存',
        () => saveFileModal()
    );
    document.getElementById('fileEditor').value = info.content;
    const editor = document.getElementById('fileEditor');
    if (editor) {
        editor.style.minHeight = '45vh';
        editor.style.height = '45vh';
    }
}

async function saveFileModal() {
    if (!currentFile) return;
    const content = document.getElementById('fileEditor').value;
    const data = await API.post('/api/files/save', { path: currentFile, content });
    if (data.result === 1) {
        showToast('文件已保存', 'success');
        closeModal();
        renderFiles();
    } else {
        showToast(data.message || '保存失败', 'error');
    }
}

// ============================================
// 下载 / 删除
// ============================================
function downloadFile(relPath) {
    const url = `/api/files/download?path=${encodeURIComponent(relPath)}&key=${encodeURIComponent(API.getSessionKey())}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = relPath.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
}

async function deleteEntry(relPath, isDir) {
    if (!confirm(`确定要删除${isDir ? '目录' : '文件'} "${relPath}" 吗？\n⚠ 此操作不可恢复！`)) return;
    const data = await API.post('/api/files/delete', { path: relPath });
    if (data.result === 1) {
        showToast('已删除', 'success');
        renderFiles();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

// ============================================
// 新建文件夹 / 上传
// ============================================
function showMkdirModal() {
    showModal('新建文件夹',
        `<div class="form-group">
            <label>文件夹名称</label>
            <input type="text" id="modalNewFolder" placeholder="输入文件夹名称..." style="width:100%;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid var(--glass-border);border-radius:6px;color:var(--text-primary);font-size:0.9rem;outline:none;box-sizing:border-box;">
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);">将在当前目录 <strong>${escapeHtml(currentDir || '根目录')}</strong> 下创建</div>`,
        '创建',
        async () => {
            const name = document.getElementById('modalNewFolder')?.value.trim();
            if (!name) {
                showToast('请输入文件夹名称', 'warning');
                return;
            }
            const rel = currentDir ? `${currentDir}/${name}` : name;
            const data = await API.post('/api/files/mkdir', { path: rel });
            if (data.result === 1) {
                showToast('文件夹已创建', 'success');
                closeModal();
                renderFiles();
            } else {
                showToast(data.message || '创建失败', 'error');
            }
        }
    );
}

function showUploadDialog() {
    const input = document.getElementById('fileUploadInput');
    if (input) input.click();
}

function initUploadListener() {
    const input = document.getElementById('fileUploadInput');
    if (!input) return;
    input.onchange = async () => {
        const files = input.files;
        if (!files || files.length === 0) return;
        let failed = 0;
        for (const file of files) {
            try {
                const buf = await file.arrayBuffer();
                const url = `/api/files/upload?path=${encodeURIComponent(currentDir)}&name=${encodeURIComponent(file.name)}&key=${encodeURIComponent(API.getSessionKey())}`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: buf
                });
                const res = await resp.json();
                if (res.result === 1) {
                    showToast(`${file.name} 上传成功`, 'success');
                } else {
                    failed++;
                    showToast(`${file.name}: ${res.message || '上传失败'}`, 'error');
                }
            } catch (e) {
                failed++;
                showToast(`${file.name} 上传失败`, 'error');
            }
        }
        input.value = '';
        renderFiles();
    };
}
