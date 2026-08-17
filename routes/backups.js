const express = require('express');
const router = express.Router();

module.exports = function(backupManager, serverManager, checkSession) {
    // Get backup list
    router.get('/api/backups/list', checkSession, (req, res) => {
        try {
            const info = backupManager.getBackupInfo();
            res.json({ result: 1, data: info });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Create backup
    router.post('/api/backups/create', checkSession, (req, res) => {
        const serverName = serverManager.config.serverName || 'servertest';

        backupManager.createBackup(serverName)
            .then((result) => {
                res.json({ result: 1, data: result, message: '备份创建成功' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Restore backup
    router.post('/api/backups/restore', checkSession, (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.json({ result: 0, message: '缺少备份名称' });
        }

        if (serverManager.running) {
            return res.json({ result: 0, message: '请先停止服务器再恢复备份' });
        }

        backupManager.restoreBackup(name)
            .then((result) => {
                res.json({ result: 1, data: result, message: '备份恢复成功' });
            })
            .catch((err) => {
                res.json({ result: 0, message: err.message });
            });
    });

    // Delete backup
    router.post('/api/backups/delete', checkSession, (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.json({ result: 0, message: '缺少备份名称' });
        }

        try {
            const result = backupManager.deleteBackup(name);
            res.json({ result: 1, data: result, message: '备份已删除' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Toggle auto backup
    router.post('/api/backups/auto', checkSession, (req, res) => {
        const { enabled } = req.body;
        const serverName = serverManager.config.serverName || 'servertest';

        try {
            if (enabled) {
                backupManager.startAutoBackup(serverName);
                res.json({ result: 1, message: '自动备份已开启' });
            } else {
                backupManager.stopAutoBackup();
                res.json({ result: 1, message: '自动备份已关闭' });
            }
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};