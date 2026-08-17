const express = require('express');
const router = express.Router();

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

    return router;
};