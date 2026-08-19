/**
 * PZ Server Panel - 地图
 */

let pzMapInstance = null;
let pzMapMarkers = [];
let pzMapRefresh = null;

function initPage() { renderMap(); }

async function renderMap() {
    const content = document.getElementById('pageContent');
    if (pzMapRefresh) { clearInterval(pzMapRefresh); pzMapRefresh = null; }

    content.innerHTML = `
        <div class="alert alert-info">🌍 地图瓦片来自社区服务。玩家位置每 10 秒从服务器日志更新一次。</div>
        <div class="flex-row">
            <div class="card" style="padding:0;overflow:hidden;flex:1;">
                <div id="pzMapContainer" style="width:100%;height:60vh;min-height:400px;background:#0a0a1a;"></div>
            </div>
            <div class="card flex-sidebar" style="display:flex;flex-direction:column;">
                <div class="card-header"><h3>玩家列表 (0) <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;">| 实时坐标</span></h3></div>
                <div class="card-body" style="flex:1;overflow-y:auto;padding:8px;" id="playerListContainer">
                    <div class="empty-state" style="padding:20px;"><h3>暂无玩家</h3></div>
                </div>
                <div style="padding:8px;border-top:1px solid var(--glass-border);display:flex;gap:6px;">
                    <button class="btn btn-sm btn-info" onclick="centerMapOnPlayers()" style="flex:1;">聚焦玩家</button>
                    <button class="btn btn-sm btn-secondary" onclick="openPzMapInNewTab()" style="flex:1;">完整地图</button>
                </div>
            </div>
        </div>
    `;
    await loadLeafletCss();
    await loadLeafletScript();
    setTimeout(() => initPzMap(), 200);
}

function loadLeafletCss() {
    return new Promise((resolve) => {
        if (document.getElementById('leaflet-css')) { resolve(); return; }
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.onload = resolve; document.head.appendChild(link);
    });
}

function loadLeafletScript() {
    return new Promise((resolve) => {
        if (window.L) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve; document.head.appendChild(script);
    });
}

function initPzMap() {
    if (pzMapInstance) { pzMapInstance.remove(); pzMapInstance = null; }
    const mapContainer = document.getElementById('pzMapContainer');
    if (!mapContainer) return;

    pzMapInstance = L.map('pzMapContainer', { center: [0, 0], zoom: 2, minZoom: 1, maxZoom: 6, zoomControl: true, attributionControl: false });
    L.tileLayer('https://map.projectzomboid.com/tiles/{z}/{x}/{y}.png', { maxZoom: 6, minZoom: 1, tileSize: 256, noWrap: true, bounds: [[-30, -30], [30, 30]] }).addTo(pzMapInstance);
    pzMapInstance.setView([0, 0], 2);
    refreshPlayerMarkers();
    if (pzMapRefresh) clearInterval(pzMapRefresh);
    pzMapRefresh = setInterval(refreshPlayerMarkers, 10000);
}

async function refreshPlayerMarkers() {
    if (!pzMapInstance) return;
    const positionData = await API.get('/api/server/player-positions');
    if (positionData.result !== 1) return;
    const players = positionData.data.players || [];

    // Update player count in header
    const headerEl = document.querySelector('.card-header h3');
    if (headerEl) {
        headerEl.innerHTML = `玩家列表 (${players.length}) <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;">| 实时坐标</span>`;
    }

    // Remove old map markers
    for (const m of pzMapMarkers) pzMapInstance.removeLayer(m);
    pzMapMarkers = [];

    // Update player list in side panel
    const listEl = document.getElementById('playerListContainer');
    if (listEl) {
        if (players.length === 0) {
            listEl.innerHTML = '<div class="empty-state" style="padding:20px;"><h3>暂无玩家</h3></div>';
        } else {
            let html = '';
            for (const p of players) {
                const color = nameToColor(p.name);
                html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.82rem;" onclick="focusPlayer(${p.x},${p.y})">
                    <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                    <span style="flex:1;font-weight:500;">${escapeHtml(p.name)}</span>
                    <span style="color:var(--text-muted);font-size:0.72rem;">${p.x}, ${p.y}</span>
                </div>`;
            }
            listEl.innerHTML = html;
        }
    }

    // Add new markers
    for (const p of players) {
        const color = nameToColor(p.name);
        const lat = -(p.y / 300) * 0.8;
        const lng = (p.x / 300) * 0.8;
        const marker = L.circleMarker([lat, lng], { radius: 8, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8 }).addTo(pzMapInstance);
        marker.bindPopup(`<div style="color:#333;font-size:13px;"><strong>${escapeHtml(p.name)}</strong><br>坐标: ${p.x}, ${p.y}<br>更新时间: ${new Date(p.time).toLocaleTimeString()}</div>`);
        pzMapMarkers.push(marker);
    }
}

function focusPlayer(x, y) {
    if (!pzMapInstance) return;
    const lat = -(y / 300) * 0.8;
    const lng = (x / 300) * 0.8;
    pzMapInstance.setView([lat, lng], 5);
}

function nameToColor(name) {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function centerMapOnPlayers() { if (!pzMapInstance || pzMapMarkers.length === 0) return; const group = L.featureGroup(pzMapMarkers); pzMapInstance.fitBounds(group.getBounds().pad(0.3)); }
function openPzMapInNewTab() { window.open('https://map.projectzomboid.com/', '_blank'); }