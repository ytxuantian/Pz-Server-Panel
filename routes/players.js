const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

module.exports = function(serverManager, checkSession) {
    // Get online players (from server log parsing)
    router.get('/api/players/online', checkSession, (req, res) => {
        try {
            const logs = serverManager.getLogs(500);
            const players = new Map();
            
            for (const log of logs) {
                // Try to parse player join/leave messages
                // PZ format: "Player <name> connected" or "Player <name> disconnected"
                const joinMatch = log.message.match(/Player\s+(.+?)\s+connected/i);
                const leaveMatch = log.message.match(/Player\s+(.+?)\s+disconnected/i);
                const chatMatch = log.message.match(/\[CHAT\]\s+(.+?):/);
                const playerListMatch = log.message.match(/^\s*-\s*(.+?)\s+\((\d+)\)/);

                if (joinMatch) {
                    const name = joinMatch[1].trim();
                    players.set(name, {
                        name: name,
                        steamId: null,
                        ip: null,
                        connectedAt: log.timestamp,
                        online: true
                    });
                } else if (leaveMatch) {
                    const name = leaveMatch[1].trim();
                    if (players.has(name)) {
                        players.get(name).online = false;
                        players.get(name).disconnectedAt = log.timestamp;
                    }
                }
            }

            // Filter online players
            const onlinePlayers = Array.from(players.values())
                .filter(p => p.online)
                .sort((a, b) => a.name.localeCompare(b.name));

            res.json({
                result: 1,
                data: {
                    count: onlinePlayers.length,
                    players: onlinePlayers
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get all known players (from sandbox or player DB files)
    router.get('/api/players/all', checkSession, (req, res) => {
        try {
            const serverName = serverManager.config.serverName || 'servertest';
            const playersDir = path.join(
                serverManager.config.installPath,
                'media',
                'saves',
                serverName,
                'players'
            );

            const players = [];

            // Try to read player data from saves
            if (fs.existsSync(playersDir)) {
                const files = fs.readdirSync(playersDir);
                for (const file of files) {
                    if (file.endsWith('.bin') || file.endsWith('.dat')) {
                        const playerName = path.basename(file, path.extname(file));
                        const stat = fs.statSync(path.join(playersDir, file));
                        players.push({
                            name: playerName,
                            file: file,
                            size: stat.size,
                            lastPlayed: stat.mtime
                        });
                    }
                }
            }

            // Also check for player.db
            const dbPath = path.join(
                serverManager.config.installPath,
                'media',
                'saves',
                serverName,
                'players.db'
            );
            if (fs.existsSync(dbPath)) {
                // Read SQLite DB would be ideal but we'll note it exists
            }

            players.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));

            res.json({
                result: 1,
                data: {
                    count: players.length,
                    players: players
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Kick player
    router.post('/api/players/kick', checkSession, (req, res) => {
        const { username, reason } = req.body;
        if (!username) {
            return res.json({ result: 0, message: '缺少玩家名' });
        }

        const command = `kick "${username}" ${reason || ''}`.trim();
        serverManager.sendCommand(command)
            .then(() => {
                res.json({ result: 1, message: `已踢出玩家: ${username}` });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Ban player
    router.post('/api/players/ban', checkSession, (req, res) => {
        const { username, reason } = req.body;
        if (!username) {
            return res.json({ result: 0, message: '缺少玩家名' });
        }

        const command = `ban "${username}" ${reason || ''}`.trim();
        serverManager.sendCommand(command)
            .then(() => {
                res.json({ result: 1, message: `已封禁玩家: ${username}` });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Unban player
    router.post('/api/players/unban', checkSession, (req, res) => {
        const { username } = req.body;
        if (!username) {
            return res.json({ result: 0, message: '缺少玩家名' });
        }

        const command = `unban "${username}"`;
        serverManager.sendCommand(command)
            .then(() => {
                res.json({ result: 1, message: `已解除封禁: ${username}` });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Send message to player
    router.post('/api/players/message', checkSession, (req, res) => {
        const { username, message } = req.body;
        if (!username || !message) {
            return res.json({ result: 0, message: '缺少参数' });
        }

        const command = `pm "${username}" "${message}"`;
        serverManager.sendCommand(command)
            .then(() => {
                res.json({ result: 1, message: '消息已发送' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Teleport player
    router.post('/api/players/teleport', checkSession, (req, res) => {
        const { username, x, y, z } = req.body;
        if (!username || x === undefined || y === undefined) {
            return res.json({ result: 0, message: '缺少参数' });
        }

        const zCoord = z || 0;
        const command = `teleport "${username}" ${x} ${y} ${zCoord}`;
        serverManager.sendCommand(command)
            .then(() => {
                res.json({ result: 1, message: '传送命令已发送' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Give item to player
    router.post('/api/players/giveitem', checkSession, (req, res) => {
        const { username, item, count } = req.body;
        if (!username || !item) {
            return res.json({ result: 0, message: '缺少参数' });
        }

        const itemCount = count || 1;
        const command = `additem "${username}" "${item}" ${itemCount}`;
        serverManager.sendCommand(command)
            .then(() => {
                res.json({ result: 1, message: '物品已发送' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Get ban list
    router.get('/api/players/bans', checkSession, (req, res) => {
        try {
            serverManager.sendCommand('showbans')
                .then((result) => {
                    res.json({ result: 1, data: { bans: result } });
                })
                .catch((err) => {
                    res.json({ result: 0, message: err.message });
                });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Save all players
    router.post('/api/players/saveall', checkSession, (req, res) => {
        serverManager.sendCommand('save')
            .then(() => {
                res.json({ result: 1, message: '已保存所有玩家数据' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Get item list from game files
    router.get('/api/players/items', checkSession, (req, res) => {
        try {
            const items = serverManager.getItemList();
            res.json({ result: 1, data: { items } });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};