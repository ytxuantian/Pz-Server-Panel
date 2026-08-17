const express = require('express');
const router = express.Router();

module.exports = function(serverManager, checkSession) {
    // Get config files list
    router.get('/api/config/list', checkSession, (req, res) => {
        try {
            const files = serverManager.getConfigFiles();
            res.json({ result: 1, data: files });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Read config file
    router.get('/api/config/read', checkSession, (req, res) => {
        try {
            const { filename } = req.query;
            if (!filename) {
                return res.json({ result: 0, message: '缺少文件名参数' });
            }
            const content = serverManager.readConfigFile(filename);
            res.json({ result: 1, data: { filename, content } });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Save config file
    router.post('/api/config/save', checkSession, (req, res) => {
        try {
            const { filename, content } = req.body;
            if (!filename || content === undefined) {
                return res.json({ result: 0, message: '缺少参数' });
            }
            const result = serverManager.writeConfigFile(filename, content);
            res.json({ result: 1, data: result, message: '配置文件已保存' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get panel settings
    router.get('/api/config/settings', checkSession, (req, res) => {
        try {
            const config = require('../config.json');
            res.json({
                result: 1,
                data: {
                    port: config.port,
                    pzServer: {
                        installPath: config.pzServer.installPath,
                        serverName: config.pzServer.serverName,
                        rconPort: config.pzServer.rconPort
                    },
                    backup: config.backup
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Save panel settings (only non-sensitive fields)
    router.post('/api/config/settings', checkSession, (req, res) => {
        try {
            const fs = require('fs');
            const currentConfig = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
            const { pzServer, backup } = req.body;

            if (pzServer) {
                if (pzServer.installPath) currentConfig.pzServer.installPath = pzServer.installPath;
                if (pzServer.serverName) currentConfig.pzServer.serverName = pzServer.serverName;
                if (pzServer.rconPort) currentConfig.pzServer.rconPort = pzServer.rconPort;
                if (pzServer.adminPassword) currentConfig.pzServer.adminPassword = pzServer.adminPassword;
                if (pzServer.rconPassword) currentConfig.pzServer.rconPassword = pzServer.rconPassword;
            }
            if (backup) {
                if (backup.enabled !== undefined) currentConfig.backup.enabled = backup.enabled;
                if (backup.interval) currentConfig.backup.interval = backup.interval;
                if (backup.maxBackups) currentConfig.backup.maxBackups = backup.maxBackups;
                if (backup.path) currentConfig.backup.path = backup.path;
            }

            fs.writeFileSync('./config.json', JSON.stringify(currentConfig, null, 2), 'utf-8');
            
            // Re-initialize backup manager with new settings
            if (global.backupManager) {
                global.backupManager.stopAutoBackup();
                global.backupManager = new (require('../services/BackupManager'))(currentConfig);
                global.backupManager.startAutoBackup(currentConfig.pzServer.serverName);
            }

            res.json({ result: 1, message: '设置已保存 (部分设置需重启面板后生效)' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};