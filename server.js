const express = require('express');
const path = require('path');
const fs = require('fs');
const ServerManager = require('./services/ServerManager');
const BackupManager = require('./services/BackupManager');

// Load config
const configPath = path.join(__dirname, 'config.json');
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
    console.error('无法加载配置文件 config.json:', err.message);
    process.exit(1);
}

// Initialize services
const serverManager = new ServerManager(config);
const backupManager = new BackupManager(config);
global.backupManager = backupManager;

// Initialize Express
const app = express();
const PORT = config.port || 57873;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize auth module
const authRouter = require('./routes/auth')(config);
const checkSession = authRouter.checkSession;

// Mount routes
app.use('/', authRouter);
app.use('/', require('./routes/server')(serverManager, checkSession));
app.use('/', require('./routes/players')(serverManager, checkSession));
app.use('/', require('./routes/config')(serverManager, checkSession));
app.use('/', require('./routes/mods')(serverManager, checkSession));
app.use('/', require('./routes/logs')(serverManager, checkSession));
app.use('/', require('./routes/backups')(backupManager, serverManager, checkSession));

// Serve frontend pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
    // For SPA-like routing, serve index.html for all non-API routes
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ result: 0, message: '服务器内部错误' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     Project Zomboid 服务器管理面板        ║');
    console.log('║     PZ Server Panel v1.0.0              ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  监听端口: ${PORT}                          ║`);
    console.log(`║  管理地址: http://127.0.0.1:${PORT}         ║`);
    console.log(`║  PZ 路径:  ${config.pzServer.installPath}   ║`);
    console.log(`║  服务器名: ${config.pzServer.serverName}     ║`);
    console.log('╚══════════════════════════════════════════╝');

    // Start auto backup if enabled
    backupManager.startAutoBackup(config.pzServer.serverName);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    serverManager.cleanup();
    backupManager.cleanup();
    if (serverManager.running) {
        serverManager.stop().then(() => {
            process.exit(0);
        }).catch(() => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    serverManager.cleanup();
    backupManager.cleanup();
    process.exit(0);
});