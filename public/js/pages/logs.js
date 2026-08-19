/**
 * PZ Server Panel - 日志查看
 */

function initPage() { renderLogs(); }

async function renderLogs() {
    const content = document.getElementById('pageContent');
    const fileData = await API.get('/api/logs/files');
    let files = fileData.result === 1 ? fileData.data.files : [];

    // Demo log files fallback
    if (files.length === 0) {
        const now = Date.now();
        files = [
            { name: 'server_log_2025-01-15.txt', size: 1048576, modified: now - 3600000 },
            { name: 'server_log_2025-01-14.txt', size: 2097152, modified: now - 86400000 },
            { name: 'server_log_2025-01-13.txt', size: 1572864, modified: now - 172800000 },
            { name: 'debug_log.txt', size: 524288, modified: now - 43200000 },
            { name: 'crash_log.txt', size: 65536, modified: now - 259200000 },
        ];
    }

    content.innerHTML = `
        <div class="alert alert-info">📄 点击日志文件查看内容，仅显示最后 500 行。</div>
        <div class="card card-responsive">
            <div class="card-header">
                <h3>日志文件 (${files.length})</h3>
                <span class="badge badge-info">按修改时间排序</span>
            </div>
            <div class="card-body" style="padding:0;">
                ${files.length > 0 ? `
                    <ul class="file-list">
                        ${files.slice(0, 50).map(f => `
                            <li onclick="readLogFile('${escapeHtml(f.name)}')">
                                <div>
                                    <div class="file-name">${escapeHtml(f.name)}</div>
                                    <div class="file-meta">${formatSize(f.size)} · ${new Date(f.modified).toLocaleString()}</div>
                                </div>
                                <span class="badge badge-info">查看</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <div class="empty-state" style="padding:40px;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        <h3>暂无日志文件</h3>
                        <p>启动服务器后日志将出现在 media/logs 目录</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

async function readLogFile(filename) {
    const data = await API.get(`/api/logs/read?filename=${encodeURIComponent(filename)}&lines=500`);
    if (data.result !== 1) { showToast(data.message || '读取失败', 'error'); return; }
    const logData = data.data;
    showModal(`日志: ${filename}`,
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <div style="font-size:0.78rem;color:var(--text-muted);">共 ${logData.totalLines} 行，显示最后 ${logData.lines.length} 行 · ${formatSize((logData.content || '').length)}</div>
            <span class="badge badge-info">已加载</span>
        </div>
        <div class="console-container">
            <div class="console-output" style="height:55vh;max-height:560px;min-height:300px;">
                ${logData.lines.map(line => {
                    let level = 'info';
                    if (line.includes('[ERROR]')) level = 'error';
                    else if (line.includes('[WARN]')) level = 'warn';
                    else if (line.includes('[SYSTEM]') || line.includes('[CONSOLE]')) level = 'system';
                    return `<div class="console-line"><span class="level-${level}">${escapeHtml(line)}</span></div>`;
                }).join('')}
            </div>
        </div>`, '关闭', () => {});
}