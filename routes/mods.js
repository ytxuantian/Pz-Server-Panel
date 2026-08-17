const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = function(serverManager, checkSession) {
    // Get all mods
    router.get('/api/mods/list', checkSession, (req, res) => {
        try {
            const mods = serverManager.getMods();
            res.json({ result: 1, data: { count: mods.length, mods } });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Enable mods
    router.post('/api/mods/enable', checkSession, (req, res) => {
        const { modIds } = req.body;
        if (!modIds || !Array.isArray(modIds) || modIds.length === 0) {
            return res.json({ result: 0, message: '缺少Mod ID参数' });
        }

        try {
            const result = serverManager.setModsEnabled(modIds, true);
            res.json({ result: 1, data: result, message: 'Mod已启用 (需重启服务器生效)' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Disable mods
    router.post('/api/mods/disable', checkSession, (req, res) => {
        const { modIds } = req.body;
        if (!modIds || !Array.isArray(modIds) || modIds.length === 0) {
            return res.json({ result: 0, message: '缺少Mod ID参数' });
        }

        try {
            const result = serverManager.setModsEnabled(modIds, false);
            res.json({ result: 1, data: result, message: 'Mod已禁用 (需重启服务器生效)' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Add workshop mod by URL or ID
    router.post('/api/mods/workshop/add', checkSession, (req, res) => {
        const { url } = req.body;
        if (!url) {
            return res.json({ result: 0, message: '请输入 Steam 创意工坊 URL 或 Mod ID' });
        }

        try {
            // Extract workshop ID from URL or use directly
            let workshopId = url.trim();
            const idMatch = url.match(/(?:id=|filedetails\/\?id=)(\d+)/);
            if (idMatch) {
                workshopId = idMatch[1];
            } else if (!/^\d+$/.test(workshopId)) {
                // Try to find any number in the string
                const numMatch = url.match(/(\d+)/);
                if (numMatch) workshopId = numMatch[1];
                else return res.json({ result: 0, message: '无法识别 Mod ID，请输入 Steam 创意工坊 URL 或数字 ID' });
            }

            // Add to server config
            const result = serverManager.setModsEnabled([workshopId], true, true);
            res.json({
                result: 1,
                data: { workshopId, ...result },
                message: `Mod [${workshopId}] 已添加至 WorkshopItems (需重启服务器生效)`
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Remove workshop mod by ID
    router.post('/api/mods/workshop/remove', checkSession, (req, res) => {
        const { workshopId } = req.body;
        if (!workshopId) {
            return res.json({ result: 0, message: '缺少 Mod ID' });
        }

        try {
            const result = serverManager.setModsEnabled([workshopId], false, true);
            res.json({ result: 1, data: result, message: `Mod [${workshopId}] 已从 WorkshopItems 移除 (需重启服务器生效)` });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get SteamCMD status / installed workshop mods
    router.get('/api/mods/workshop/list', checkSession, (req, res) => {
        try {
            const configContent = serverManager.readConfigFile(`${serverManager.config.serverName}.ini`);
            const workshopIds = [];
            const lines = configContent.split('\n');
            for (const line of lines) {
                if (line.trim().toLowerCase().startsWith('workshopitems=')) {
                    const value = line.split('=')[1]?.trim() || '';
                    if (value) {
                        workshopIds.push(...value.split(';').map(m => m.trim()).filter(Boolean));
                    }
                }
            }

            // Check if any of these are actually downloaded
            const isWindows = process.platform === 'win32';
            let workshopPath;
            if (isWindows) {
                workshopPath = path.join(serverManager.config.installPath.replace('ProjectZomboid', 'workshop'), 'content', '108600');
            } else {
                const home = require('os').homedir();
                const altPaths = [
                    path.join(home, '.steam', 'steam', 'steamapps', 'workshop', 'content', '108600'),
                    path.join(home, 'Steam', 'steamapps', 'workshop', 'content', '108600'),
                ];
                workshopPath = altPaths.find(p => fs.existsSync(p)) || altPaths[0];
            }

            const installed = [];
            if (fs.existsSync(workshopPath)) {
                const items = fs.readdirSync(workshopPath);
                for (const item of items) {
                    const itemPath = path.join(workshopPath, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        installed.push({
                            id: item,
                            path: itemPath,
                            inConfig: workshopIds.includes(item)
                        });
                    }
                }
            }

            res.json({
                result: 1,
                data: {
                    configuredInServer: workshopIds,
                    installed: installed,
                    workshopPath: workshopPath
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};