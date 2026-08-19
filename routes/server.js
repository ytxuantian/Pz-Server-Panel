const express = require('express');
const router = express.Router();

module.exports = function(serverManager, checkSession) {
    // Get server status
    router.get('/api/server/status', checkSession, (req, res) => {
        try {
            const status = serverManager.getStatus();
            res.json({ result: 1, data: status });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Start server
    router.post('/api/server/start', checkSession, (req, res) => {
        serverManager.start()
            .then((result) => {
                res.json({ result: 1, data: result, message: '服务器启动成功' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Stop server
    router.post('/api/server/stop', checkSession, (req, res) => {
        serverManager.stop()
            .then((result) => {
                res.json({ result: 1, data: result, message: '服务器停止成功' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Restart server
    router.post('/api/server/restart', checkSession, (req, res) => {
        serverManager.restart()
            .then((result) => {
                res.json({ result: 1, data: result, message: '服务器重启成功' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Send console command
    router.post('/api/server/command', checkSession, (req, res) => {
        const { command } = req.body;
        if (!command) {
            return res.json({ result: 0, message: '缺少命令参数' });
        }

        serverManager.sendCommand(command)
            .then((result) => {
                res.json({ result: 1, data: result, message: '命令已发送' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Get server logs
    router.get('/api/server/logs', checkSession, (req, res) => {
        try {
            const count = parseInt(req.query.count) || 100;
            const logs = serverManager.getLogs(count);
            res.json({ result: 1, data: logs });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get server stats (for dashboard) — includes system info & game version
    router.get('/api/server/stats', checkSession, (req, res) => {
        try {
            const status = serverManager.getStatus();
            const logs = serverManager.getLogs(50);
            const playerHistory = [];
            for (const log of logs) {
                const match = log.message.match(/(\d+)\s+players?\s+connected/i);
                if (match) {
                    playerHistory.push({ time: log.timestamp, count: parseInt(match[1]) });
                }
            }

            // System info
            const os = require('os');
            const cpus = os.cpus();
            let totalIdle = 0, totalTick = 0;
            for (const cpu of cpus) {
                totalIdle += cpu.times.idle;
                totalTick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
            }
            const sysInfo = {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                cpuModel: cpus.length > 0 ? cpus[0].model.trim() : '',
                cpuCores: cpus.length,
                cpuUsage: cpus.length > 0 ? ((1 - totalIdle / totalTick) * 100).toFixed(1) : 0,
                totalMem: os.totalmem(),
                freeMem: os.freemem(),
                uptime: os.uptime(),
                nodeVersion: process.version
            };

            // PZ game version
            let gameVersion = '未知';
            const fs = require('fs');
            const path = require('path');
            const installPath = serverManager.config.installPath;
            if (installPath && fs.existsSync(installPath)) {
                // Check version.txt or similar
                const versionFiles = ['version.txt', 'Version.txt', 'VERSION', 'media/version.txt'];
                for (const vf of versionFiles) {
                    const vp = path.join(installPath, vf);
                    if (fs.existsSync(vp)) {
                        try {
                            const content = fs.readFileSync(vp, 'utf-8').trim();
                            if (content) { gameVersion = content.split('\n')[0].trim(); break; }
                        } catch (e) {}
                    }
                }
                // If not found, check the exe version on Windows
                if (gameVersion === '未知') {
                    const exePath = path.join(installPath, 'ProjectZomboidServer.exe');
                    if (fs.existsSync(exePath)) {
                        try {
                            const ver = require('child_process').execSync(
                                `wmic datafile where name="${exePath.replace(/\\/g, '\\\\')}" get Version /value 2>nul`,
                                { encoding: 'utf-8', timeout: 3000 }
                            );
                            const m = ver.match(/Version=([^\r\n]+)/);
                            if (m) gameVersion = m[1].trim();
                        } catch (e) {}
                    }
                }
                // Check modinfo for build number
                if (gameVersion === '未知') {
                    const modInfoPath = path.join(installPath, 'media', 'mods', 'mod.info');
                    if (fs.existsSync(modInfoPath)) {
                        try {
                            const content = fs.readFileSync(modInfoPath, 'utf-8');
                            const m = content.match(/version\s*=\s*([^\r\n]+)/i);
                            if (m) gameVersion = m[1].trim();
                        } catch (e) {}
                    }
                }
            }

            res.json({
                result: 1,
                data: {
                    status,
                    playerHistory: playerHistory.slice(-20),
                    system: sysInfo,
                    gameVersion
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });
    router.get('/api/server/player-positions', checkSession, (req, res) => {
        try {
            const logs = serverManager.getLogs(1000);
            const players = new Map();

            const patterns = [
                { regex: /Player\s+(.+?)\s+at\s+(-?\d+\.?\d*)\s*[,，]\s*(-?\d+\.?\d*)/i, nameIdx: 1, xIdx: 2, yIdx: 3 },
                { regex: /Player\s+(.+?)[:：]\s*x[=:]\s*(-?\d+\.?\d*).*?y[=:]\s*(-?\d+\.?\d*)/i, nameIdx: 1, xIdx: 2, yIdx: 3 },
                { regex: /(-?\d+\.?\d*)\s*[,，]\s*(-?\d+\.?\d*)\s*[-–]\s*(.+)/, nameIdx: 3, xIdx: 1, yIdx: 2 },
                { regex: /teleport[^\s]*\s+["']?([^"'\s]+)["']?\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/i, nameIdx: 1, xIdx: 2, yIdx: 3 },
                { regex: /Player\s+(.+?)\s+moved\s+to\s+(-?\d+\.?\d*)\s*[,，]\s*(-?\d+\.?\d*)/i, nameIdx: 1, xIdx: 2, yIdx: 3 },
                { regex: /(-?\d+\.?\d*)\s*[,，]\s*(-?\d+\.?\d*)\s*[-–]\s*(.+?)\s+is\s+here/i, nameIdx: 3, xIdx: 1, yIdx: 2 }
            ];

            for (const log of logs) {
                const msg = log.message;
                for (const pattern of patterns) {
                    const match = msg.match(pattern.regex);
                    if (match) {
                        const name = match[pattern.nameIdx].trim();
                        const x = parseFloat(match[pattern.xIdx]);
                        const y = parseFloat(match[pattern.yIdx]);
                        const time = log.timestamp;

                        if (!isNaN(x) && !isNaN(y)) {
                            const existing = players.get(name);
                            if (!existing || new Date(time) > new Date(existing.time)) {
                                players.set(name, {
                                    name,
                                    x: Math.round(x),
                                    y: Math.round(y),
                                    time
                                });
                            }
                        }
                        break;
                    }
                }
            }

            res.json({
                result: 1,
                data: {
                    count: players.size,
                    players: Array.from(players.values())
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};