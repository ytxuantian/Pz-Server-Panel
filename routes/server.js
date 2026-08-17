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

    // Get server stats (for dashboard)
    router.get('/api/server/stats', checkSession, (req, res) => {
        try {
            const status = serverManager.getStatus();
            const logs = serverManager.getLogs(50);
            // Parse some stats from recent logs
            const playerHistory = [];
            for (const log of logs) {
                const match = log.message.match(/(\d+)\s+players?\s+connected/i);
                if (match) {
                    playerHistory.push({
                        time: log.timestamp,
                        count: parseInt(match[1])
                    });
                }
            }

            res.json({
                result: 1,
                data: {
                    status,
                    playerHistory: playerHistory.slice(-20)
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get player positions parsed from server logs
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