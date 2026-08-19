/**
 * PZ Server Panel - 备份管理
 */

function initPage() { renderBackups(); }

async function renderBackups() {
    const content = document.getElementById('pageContent');
    const data = await API.get('/api/backups/list');
    const info = data.result === 1 ? data.data : { backups: [], maxBackups: 10, enabled: true, backupPath: 'backups', savesPath: 'C:\\PZ\\Saves' };
    let backups = info.backups || [];

    // Demo backups fallback
    if (backups.length === 0) {
        const now = Date.now();
        backups = [
            { name: 'backup_2025-01-15_120000', size: 524288000, created: now - 86400000 },
            { name: 'backup_2025-01-14_120000', size: 519372800, created: now - 172800000 },
            { name: 'backup_2025-01-13_120000', size: 510656000, created: now - 259200000 },
            { name: 'backup_2025-01-12_120000', size: 508000000, created: now - 345600000 },
        ];
    }

    content.innerHTML = `
        <div class="flex-row">
            <div class="card flex-sidebar" style="margin:0;">
                <div class="card-header"><h3>备份操作</h3></div>
                <div class="card-body">
                    <div class="server-controls" style="flex-wrap:wrap;gap:10px;">
                        <button class="btn btn-primary" onclick="createBackup()">创建备份</button>
                        <label class="toggle-switch">
                            <input type="checkbox" ${info.enabled ? 'checked' : ''} onchange="toggleAutoBackup(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                        <span class="text-muted">自动备份</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
                        <div class="form-group"><label>备份间隔 (分钟)</label><input type="number" id="backup_interval" value="${info.interval || 360}" style="width:100%;"></div>
                        <div class="form-group"><label>最大备份数</label><input type="number" id="backup_max" value="${info.maxBackups || 10}" style="width:100%;"></div>
                        <div class="form-group" style="grid-column:1/-1;"><label>备份路径</label><input type="text" id="backup_path" value="${escapeHtml(info.backupPath || 'backups')}" style="width:100%;"></div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="saveBackupSettings()" style="margin-top:8px;">保存备份设置</button>
                    <div class="alert alert-info mt-4" style="margin-top:10px;font-size:0.82rem;">
                        💾 存档路径: ${info.savesPath || '-'}
                    </div>
                </div>
            </div>
            <div class="card" style="margin:0;">
                <div class="card-header"><h3>备份列表 (${backups.length})</h3></div>
                <div class="card-body">
                    ${backups.length > 0 ? `
                        <div class="backup-list">
                            ${backups.map(b => `
                                <div class="backup-item">
                                    <div class="backup-info"><div class="backup-name">${escapeHtml(b.name)}</div><div class="backup-meta">${formatSize(b.size)} | ${new Date(b.created).toLocaleString()}</div></div>
                                    <div class="backup-actions">
                                        <button class="btn btn-sm btn-info" onclick="restoreBackup('${b.name}')">恢复</button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteBackup('${b.name}')">删除</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<div class="empty-state"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><h3>暂无备份</h3><p>点击"创建备份"按钮创建第一个备份</p></div>`}
                </div>
            </div>
        </div>
    `;
}

async function saveBackupSettings() {
    const data = await API.post('/api/config/settings', {
        backup: {
            enabled: document.querySelector('#backup_interval')?.closest('.card')?.querySelector('input[type="checkbox"]')?.checked ?? true,
            interval: parseInt(document.getElementById('backup_interval')?.value) || 360,
            maxBackups: parseInt(document.getElementById('backup_max')?.value) || 10,
            path: document.getElementById('backup_path')?.value || 'backups'
        }
    });
    if (data.result === 1) showToast('备份设置已保存', 'success');
    else showToast(data.message || '保存失败', 'error');
}

async function createBackup() {
    const data = await API.post('/api/backups/create');
    if (data.result === 1) { showToast('备份创建成功', 'success'); renderBackups(); }
    else showToast(data.message || '创建失败', 'error');
}

async function restoreBackup(name) {
    if (!confirm(`确定要从备份 "${name}" 恢复存档吗？\n\n⚠ 警告: 此操作将覆盖当前存档！\n请确保服务器已停止。`)) return;
    const data = await API.post('/api/backups/restore', { name });
    if (data.result === 1) showToast('备份恢复成功', 'success');
    else showToast(data.message || '恢复失败', 'error');
}

async function deleteBackup(name) {
    if (!confirm(`确定要删除备份 "${name}" 吗？`)) return;
    const data = await API.post('/api/backups/delete', { name });
    if (data.result === 1) { showToast('备份已删除', 'success'); renderBackups(); }
    else showToast(data.message || '删除失败', 'error');
}

async function toggleAutoBackup(enabled) {
    const data = await API.post('/api/backups/auto', { enabled });
    if (data.result === 1) showToast(`自动备份已${enabled ? '开启' : '关闭'}`, 'success');
}