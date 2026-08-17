const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

module.exports = function(serverManager, checkSession) {
    // Get server logs from in-memory buffer
    router.get('/api/logs/server', checkSession, (req, res) => {
        try {
            const count = parseInt(req.query.count) || 100;
            const logs = serverManager.getLogs(count);
            res.json({ result: 1, data: logs });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get log files from disk
    router.get('/api/logs/files', checkSession, (req, res) => {
        try {
            const serverName = serverManager.config.serverName || 'servertest';
            const logDir = path.join(
                serverManager.config.installPath,
                'media',
                'logs',
                serverName
            );

            const logFiles = [];
            
            // Check standard log directory
            if (fs.existsSync(logDir)) {
                const files = fs.readdirSync(logDir);
                for (const file of files) {
                    const filePath = path.join(logDir, file);
                    const stat = fs.statSync(filePath);
                    logFiles.push({
                        name: file,
                        path: filePath,
                        size: stat.size,
                        modified: stat.mtime
                    });
                }
            }

            // Check root logs directory
            const rootLogDir = path.join(serverManager.config.installPath, 'logs');
            if (fs.existsSync(rootLogDir)) {
                const files = fs.readdirSync(rootLogDir);
                for (const file of files) {
                    const filePath = path.join(rootLogDir, file);
                    const stat = fs.statSync(filePath);
                    // Avoid duplicates
                    if (!logFiles.find(f => f.name === file)) {
                        logFiles.push({
                            name: file,
                            path: filePath,
                            size: stat.size,
                            modified: stat.mtime
                        });
                    }
                }
            }

            // Sort by modification time (newest first)
            logFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));

            res.json({ result: 1, data: { count: logFiles.length, files: logFiles } });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Read a specific log file
    router.get('/api/logs/read', checkSession, (req, res) => {
        try {
            const { filename, lines } = req.query;
            const maxLines = parseInt(lines) || 200;

            if (!filename) {
                return res.json({ result: 0, message: '缺少文件名参数' });
            }

            const serverName = serverManager.config.serverName || 'servertest';
            const logDir = path.join(
                serverManager.config.installPath,
                'media',
                'logs',
                serverName
            );
            const rootLogDir = path.join(serverManager.config.installPath, 'logs');

            let filePath = path.join(logDir, filename);
            if (!fs.existsSync(filePath)) {
                filePath = path.join(rootLogDir, filename);
            }

            if (!fs.existsSync(filePath)) {
                return res.json({ result: 0, message: '日志文件不存在' });
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const allLines = content.split('\n');
            const lastLines = allLines.slice(-maxLines);

            res.json({
                result: 1,
                data: {
                    filename,
                    totalLines: allLines.length,
                    lines: lastLines,
                    content: lastLines.join('\n')
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Search logs
    router.get('/api/logs/search', checkSession, (req, res) => {
        try {
            const { query, filename } = req.query;
            if (!query) {
                return res.json({ result: 0, message: '缺少搜索关键词' });
            }

            // Search in-memory logs first
            const allLogs = serverManager.getLogs(1000);
            const matched = allLogs.filter(log => 
                log.message.toLowerCase().includes(query.toLowerCase())
            );

            // Also search log files if specified
            if (filename) {
                const serverName = serverManager.config.serverName || 'servertest';
                const logDir = path.join(
                    serverManager.config.installPath,
                    'media',
                    'logs',
                    serverName
                );
                const filePath = path.join(logDir, filename);
                
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const fileLines = content.split('\n');
                    const fileMatches = fileLines
                        .filter(line => line.toLowerCase().includes(query.toLowerCase()))
                        .map(line => ({ timestamp: '', message: line }));
                    matched.push(...fileMatches);
                }
            }

            res.json({
                result: 1,
                data: {
                    count: matched.length,
                    results: matched.slice(-200)
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Clear server log buffer
    router.post('/api/logs/clear', checkSession, (req, res) => {
        try {
            // Clear the in-memory buffer by re-initializing
            while (serverManager.logBuffer.length > 0) {
                serverManager.logBuffer.shift();
            }
            res.json({ result: 1, message: '日志缓冲区已清空' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};