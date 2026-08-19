const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ServerManager {
    constructor(config) {
        this.config = config.pzServer;
        this.process = null;
        this.running = false;
        this.startTime = null;
        this.stats = {
            cpu: 0,
            memory: 0,
            uptime: 0,
            players: 0,
            fps: 0
        };
        this.logBuffer = [];
        this.maxLogLines = 1000;
        this._statsInterval = null;
    }

    getServerPath() {
        return this.config.installPath;
    }

    getServerExe() {
        const isWindows = process.platform === 'win32';
        const installPath = this.config.installPath;
        if (isWindows) {
            const exePath = path.join(installPath, 'ProjectZomboidServer.exe');
            const altPath = path.join(installPath, 'ProjectZomboid64.exe');
            if (fs.existsSync(exePath)) return exePath;
            if (fs.existsSync(altPath)) return altPath;
            return path.join(installPath, 'ProjectZomboidServer.exe');
        }
        // Linux: check for the server binary, fallback to start script
        const linuxExe = path.join(installPath, 'ProjectZomboidServer');
        const linux64 = path.join(installPath, 'ProjectZomboid64');
        if (fs.existsSync(linuxExe)) return linuxExe;
        if (fs.existsSync(linux64)) return linux64;
        // Common Linux PZ dedi server naming
        const linuxDedi = path.join(installPath, 'start-server.sh');
        if (fs.existsSync(linuxDedi)) return linuxDedi;
        return path.join(installPath, 'ProjectZomboidServer');
    }

    getStartScript() {
        const isWindows = process.platform === 'win32';
        const installPath = this.config.installPath;
        if (isWindows) {
            const scriptPath = path.join(installPath, 'start-server.bat');
            const altScript = path.join(installPath, 'start-server64.bat');
            if (fs.existsSync(altScript)) return altScript;
            if (fs.existsSync(scriptPath)) return scriptPath;
            return null;
        }
        // Linux: check for start-server.sh
        const scriptPath = path.join(installPath, 'start-server.sh');
        if (fs.existsSync(scriptPath)) return scriptPath;
        // Check for the dedicated server shell script
        const linuxScript = path.join(installPath, 'ProjectZomboidServer');
        if (fs.existsSync(linuxScript)) return linuxScript;
        return null;
    }

    getStatus() {
        return {
            running: this.running,
            pid: this.process ? this.process.pid : null,
            startTime: this.startTime,
            uptime: this.running && this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
            stats: this.stats,
            serverName: this.config.serverName,
            installPath: this.config.installPath
        };
    }

    start() {
        return new Promise((resolve, reject) => {
            if (this.running) {
                reject(new Error('服务器已在运行中'));
                return;
            }

            const serverName = this.config.serverName || 'servertest';
            const adminPassword = this.config.adminPassword || '';
            const isWindows = process.platform === 'win32';
            
            console.log(`[ServerManager] 正在启动 Project Zomboid 服务器: ${serverName}`);

            try {
                let cmd, args;
                const startScript = this.getStartScript();

                if (startScript && fs.existsSync(startScript)) {
                    if (isWindows) {
                        cmd = startScript;
                        args = [];
                    } else {
                        // On Linux, make the script executable first
                        try {
                            execSync(`chmod +x "${startScript}" 2>/dev/null`);
                        } catch (e) { /* ignore */ }
                        cmd = 'bash';
                        args = [startScript];
                    }
                } else {
                    // Construct command manually
                    const exePath = this.getServerExe();
                    cmd = exePath;
                    args = [
                        '-servername', serverName,
                        '-adminpassword', adminPassword
                    ];
                    if (!isWindows) {
                        // On Linux, ensure the binary is executable
                        try {
                            execSync(`chmod +x "${exePath}" 2>/dev/null`);
                        } catch (e) { /* ignore */ }
                    }
                }

                console.log(`[ServerManager] 执行: ${cmd} ${args.join(' ')}`);

                const options = {
                    cwd: this.config.installPath,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    windowsHide: false
                };

                if (isWindows) {
                    options.shell = true;
                }

                this.process = spawn(cmd, args, options);

                this.running = true;
                this.startTime = Date.now();

                this.process.stdout.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        this._addLog(line);
                        this._parseStats(line);
                    }
                });

                this.process.stderr.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        this._addLog(`[ERROR] ${line}`);
                    }
                });

                this.process.on('close', (code) => {
                    console.log(`[ServerManager] 服务器进程已退出，退出码: ${code}`);
                    this._addLog(`[SYSTEM] 服务器进程已退出 (退出码: ${code})`);
                    this.running = false;
                    this.process = null;
                    this.startTime = null;
                    if (this._statsInterval) {
                        clearInterval(this._statsInterval);
                        this._statsInterval = null;
                    }
                });

                this.process.on('error', (err) => {
                    console.error(`[ServerManager] 启动失败:`, err.message);
                    this._addLog(`[ERROR] 启动失败: ${err.message}`);
                    this.running = false;
                    this.process = null;
                    this.startTime = null;
                    reject(err);
                });

                // Start stats monitoring
                this._startStatsMonitoring();

                // Wait a bit to check if process is still alive
                setTimeout(() => {
                    if (this.running) {
                        resolve({ success: true, pid: this.process.pid });
                    }
                }, 3000);

            } catch (err) {
                console.error(`[ServerManager] 启动异常:`, err);
                reject(err);
            }
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            if (!this.running || !this.process) {
                reject(new Error('服务器未在运行'));
                return;
            }

            console.log('[ServerManager] 正在停止服务器...');
            this._addLog('[SYSTEM] 正在停止服务器...');

            try {
                const isWindows = process.platform === 'win32';
                
                // Send "quit" command to the server console (works on both platforms)
                try {
                    this.process.stdin.write('quit\n');
                } catch (e) {
                    // If stdin write fails, use signal
                    if (!isWindows) {
                        this.process.kill('SIGTERM');
                    }
                }

                // Force kill after timeout
                const forceKillTimeout = setTimeout(() => {
                    if (this.running && this.process) {
                        console.log('[ServerManager] 强制终止服务器进程');
                        this._addLog('[SYSTEM] 强制终止服务器进程');
                        const pid = this.process.pid;
                        if (isWindows) {
                            try { execSync(`taskkill /PID ${pid} /F /T 2>nul`); } catch (e) {}
                        } else {
                            try {
                                execSync(`kill -9 ${pid} 2>/dev/null`);
                                // Also kill any child processes
                                execSync(`pkill -P ${pid} 2>/dev/null`);
                            } catch (e) {}
                        }
                    }
                }, 30000);

                this.process.on('close', () => {
                    clearTimeout(forceKillTimeout);
                    resolve({ success: true });
                });

            } catch (err) {
                console.error('[ServerManager] 停止失败:', err);
                reject(err);
            }
        });
    }

    restart() {
        return this.stop().then(() => {
            // Wait a bit before restarting
            return new Promise((resolve) => setTimeout(resolve, 5000));
        }).then(() => {
            return this.start();
        });
    }

    sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.running || !this.process) {
                reject(new Error('服务器未在运行'));
                return;
            }

            try {
                this.process.stdin.write(`${command}\n`);
                this._addLog(`[CONSOLE] > ${command}`);
                resolve({ success: true, command });
            } catch (err) {
                reject(err);
            }
        });
    }

    getLogs(count = 100) {
        return this.logBuffer.slice(-count);
    }

    getConfigFiles() {
        const serverName = this.config.serverName || 'servertest';
        const configDir = path.join(
            this.config.installPath,
            'media',
            'config'
        );
        
        const results = [];
        if (fs.existsSync(configDir)) {
            const files = fs.readdirSync(configDir).filter(f => f.endsWith('.ini'));
            for (const file of files) {
                const filePath = path.join(configDir, file);
                const stat = fs.statSync(filePath);
                results.push({
                    name: file,
                    path: filePath,
                    size: stat.size,
                    modified: stat.mtime
                });
            }
        }

        // Also check for server-specific config
        const serverConfigPath = path.join(
            this.config.installPath,
            'media',
            'config',
            `${serverName}.ini`
        );
        if (fs.existsSync(serverConfigPath)) {
            const stat = fs.statSync(serverConfigPath);
            const exists = results.find(r => r.name === `${serverName}.ini`);
            if (!exists) {
                results.push({
                    name: `${serverName}.ini`,
                    path: serverConfigPath,
                    size: stat.size,
                    modified: stat.mtime
                });
            }
        }

        return results;
    }

    readConfigFile(filename) {
        const serverName = this.config.serverName || 'servertest';
        const configDir = path.join(this.config.installPath, 'media', 'config');
        let filePath = path.join(configDir, filename);
        
        if (!fs.existsSync(filePath)) {
            // Try the server-specific config
            filePath = path.join(configDir, `${serverName}.ini`);
        }

        if (!fs.existsSync(filePath)) {
            throw new Error('配置文件不存在');
        }

        return fs.readFileSync(filePath, 'utf-8');
    }

    writeConfigFile(filename, content) {
        const serverName = this.config.serverName || 'servertest';
        const configDir = path.join(this.config.installPath, 'media', 'config');
        let filePath = path.join(configDir, filename);

        if (!fs.existsSync(filePath)) {
            filePath = path.join(configDir, `${serverName}.ini`);
        }

        // Backup original
        if (fs.existsSync(filePath)) {
            const backupDir = path.join(this.config.installPath, 'config_backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const backupName = `${filename}.${Date.now()}.bak`;
            fs.copyFileSync(filePath, path.join(backupDir, backupName));
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, file: filename };
    }

    getMods() {
        const modsDir = path.join(this.config.installPath, 'mods');
        const isWindows = process.platform === 'win32';
        let workshopDir;
        if (isWindows) {
            workshopDir = path.join(
                this.config.installPath.replace('ProjectZomboid', 'workshop'),
                'content',
                '108600'
            );
        } else {
            // Linux: workshop content is typically in ~/.steam/steam/steamapps/workshop/content/108600
            const steamPath = path.join(require('os').homedir(), '.steam', 'steam');
            workshopDir = path.join(steamPath, 'steamapps', 'workshop', 'content', '108600');
            // Also check common alternative paths
            const altPaths = [
                path.join(require('os').homedir(), 'Steam', 'steamapps', 'workshop', 'content', '108600'),
                path.join(require('os').homedir(), '.local', 'share', 'Steam', 'steamapps', 'workshop', 'content', '108600'),
            ];
            for (const alt of altPaths) {
                if (fs.existsSync(alt)) {
                    workshopDir = alt;
                    break;
                }
            }
        }

        const mods = [];

        // Check local mods
        if (fs.existsSync(modsDir)) {
            const items = fs.readdirSync(modsDir);
            for (const item of items) {
                const itemPath = path.join(modsDir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const modInfo = this._readModInfo(itemPath);
                    mods.push({
                        name: item,
                        path: itemPath,
                        type: 'local',
                        enabled: false,
                        ...modInfo
                    });
                }
            }
        }

        // Check workshop mods
        if (fs.existsSync(workshopDir)) {
            const items = fs.readdirSync(workshopDir);
            for (const item of items) {
                const itemPath = path.join(workshopDir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const modInfo = this._readModInfo(itemPath);
                    mods.push({
                        name: item,
                        path: itemPath,
                        type: 'workshop',
                        enabled: false,
                        ...modInfo
                    });
                }
            }
        }

        // Get enabled mods from server config
        try {
            const serverConfig = this.readConfigFile(`${this.config.serverName}.ini`);
            const enabledMods = this._parseEnabledMods(serverConfig);
            for (const mod of mods) {
                if (enabledMods.includes(mod.name) || enabledMods.includes(mod.id)) {
                    mod.enabled = true;
                }
            }
        } catch (e) {
            // Ignore if config file doesn't exist
        }

        return mods;
    }

    setModsEnabled(modIds, enabled, isWorkshop = false) {
        const serverName = this.config.serverName || 'servertest';
        const configPath = path.join(
            this.config.installPath,
            'media',
            'config',
            `${serverName}.ini`
        );

        if (!fs.existsSync(configPath)) {
            throw new Error('服务器配置文件不存在');
        }

        let content = fs.readFileSync(configPath, 'utf-8');
        const lines = content.split('\n');
        let newLines = [];
        let hasModsLine = false;
        let hasWorkshopLine = false;

        for (const line of lines) {
            if (line.trim().toLowerCase().startsWith('mods=') && !isWorkshop) {
                const currentMods = line.split('=')[1]?.trim() || '';
                const currentList = currentMods ? currentMods.split(';') : [];
                let newList = [...currentList];

                for (const modId of modIds) {
                    if (enabled && !newList.includes(modId)) {
                        newList.push(modId);
                    } else if (!enabled) {
                        newList = newList.filter(m => m !== modId);
                    }
                }

                newLines.push(`Mods=${newList.join(';')}`);
                hasModsLine = true;
            } else if (line.trim().toLowerCase().startsWith('workshopitems=')) {
                const currentMods = line.split('=')[1]?.trim() || '';
                const currentList = currentMods ? currentMods.split(';') : [];
                let newList = [...currentList];

                for (const modId of modIds) {
                    if (enabled && !newList.includes(modId)) {
                        newList.push(modId);
                    } else if (!enabled) {
                        newList = newList.filter(m => m !== modId);
                    }
                }

                newLines.push(`WorkshopItems=${newList.join(';')}`);
                hasWorkshopLine = true;
            } else {
                newLines.push(line);
            }
        }

        // If the config line didn't exist, add it
        if (!hasModsLine && !isWorkshop) {
            newLines.push(`Mods=${modIds.filter(id => enabled).join(';')}`);
        }
        if (!hasWorkshopLine) {
            newLines.push(`WorkshopItems=${modIds.filter(id => enabled).join(';')}`);
        }

        // Backup and write
        const backupDir = path.join(this.config.installPath, 'config_backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        fs.copyFileSync(configPath, path.join(backupDir, `${serverName}.ini.${Date.now()}.bak`));
        fs.writeFileSync(configPath, newLines.join('\n'), 'utf-8');

        return { success: true };
    }

    getBackups() {
        const backupPath = this.config.backup?.path || path.join(this.config.installPath, '..', 'backups');
        const savesDir = path.join(
            this.config.installPath,
            'media',
            'saves'
        );

        const backups = [];

        // Check for existing backups
        if (fs.existsSync(backupPath)) {
            const items = fs.readdirSync(backupPath);
            for (const item of items) {
                const itemPath = path.join(backupPath, item);
                const stat = fs.statSync(itemPath);
                backups.push({
                    name: item,
                    path: itemPath,
                    size: stat.size,
                    created: stat.mtime,
                    type: stat.isDirectory() ? 'directory' : 'file'
                });
            }
        }

        // Sort by creation time (newest first)
        backups.sort((a, b) => new Date(b.created) - new Date(a.created));

        return {
            backups,
            savesPath: savesDir,
            backupPath
        };
    }

    createBackup() {
        const savesDir = path.join(
            this.config.installPath,
            'media',
            'saves'
        );

        const backupPath = this.config.backup?.path || path.join(this.config.installPath, '..',  'backups');
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        if (!fs.existsSync(savesDir)) {
            throw new Error('存档目录不存在');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `backup-${this.config.serverName}-${timestamp}`;
        const backupDest = path.join(backupPath, backupName);

        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            let cmd, args;

            if (isWindows) {
                cmd = 'robocopy';
                args = [savesDir, backupDest, '/E', '/COPY:DAT', '/R:0', '/W:0', '/NFL', '/NDL', '/NJH', '/NJS'];
            } else {
                cmd = 'cp';
                args = ['-r', savesDir, backupDest];
            }

            const proc = spawn(cmd, args, { stdio: 'pipe' });
            let output = '';

            proc.stdout.on('data', (data) => { output += data.toString(); });
            proc.stderr.on('data', (data) => { output += data.toString(); });

            proc.on('close', (code) => {
                if (code === 0 || code === 1) { // robocopy exit codes 0-7 are success
                    this._addLog(`[BACKUP] 备份创建成功: ${backupName}`);
                    resolve({ success: true, name: backupName, path: backupDest });
                } else {
                    reject(new Error(`备份失败，退出码: ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }

    restoreBackup(backupName) {
        const backupPath = this.config.backup?.path || path.join(this.config.installPath, '..', 'backups');
        const savesDir = path.join(this.config.installPath, 'media', 'saves');
        const backupSource = path.join(backupPath, backupName);

        if (!fs.existsSync(backupSource)) {
            throw new Error('备份文件不存在');
        }

        if (this.running) {
            throw new Error('请先停止服务器再恢复备份');
        }

        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            let cmd, args;

            // Remove current saves
            if (fs.existsSync(savesDir)) {
                if (isWindows) {
                    execSync(`rmdir /S /Q "${savesDir}" 2>nul`);
                } else {
                    execSync(`rm -rf "${savesDir}"`);
                }
            }

            // Restore from backup
            if (isWindows) {
                cmd = 'robocopy';
                args = [backupSource, savesDir, '/E', '/COPY:DAT', '/R:0', '/W:0', '/NFL', '/NDL', '/NJH', '/NJS'];
            } else {
                cmd = 'cp';
                args = ['-r', backupSource, savesDir];
            }

            const proc = spawn(cmd, args, { stdio: 'pipe' });

            proc.on('close', (code) => {
                if (code === 0 || code === 1) {
                    this._addLog(`[BACKUP] 备份恢复成功: ${backupName}`);
                    resolve({ success: true, name: backupName });
                } else {
                    reject(new Error(`恢复失败，退出码: ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }

    // Private methods

    _addLog(line) {
        const entry = {
            timestamp: new Date().toISOString(),
            message: line
        };
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxLogLines) {
            this.logBuffer.shift();
        }
    }

    _parseStats(line) {
        // Try to parse player count from log
        const playerMatch = line.match(/(\d+)\s+players?\s+connected/i);
        if (playerMatch) {
            this.stats.players = parseInt(playerMatch[1]);
        }

        // Try to parse FPS
        const fpsMatch = line.match(/fps[:\s]+(\d+)/i);
        if (fpsMatch) {
            this.stats.fps = parseInt(fpsMatch[1]);
        }
    }

    _startStatsMonitoring() {
        this._statsInterval = setInterval(() => {
            if (!this.running || !this.process) {
                return;
            }

            try {
                // Get process stats
                const pid = this.process.pid;
                if (process.platform === 'win32') {
                    try {
                        const output = execSync(
                            `tasklist /FI "PID eq ${pid}" /FO CSV /NH 2>nul`,
                            { encoding: 'utf-8', timeout: 3000 }
                        );
                        const parts = output.split(',');
                        if (parts.length >= 5) {
                            const memStr = parts[4]?.replace(/[^0-9]/g, '') || '0';
                            this.stats.memory = parseInt(memStr) || 0;
                        }
                    } catch (e) {
                        // Ignore
                    }
                } else {
                    try {
                        const output = execSync(
                            `ps -p ${pid} -o %cpu,rss --no-headers 2>/dev/null`,
                            { encoding: 'utf-8', timeout: 3000 }
                        );
                        const parts = output.trim().split(/\s+/);
                        if (parts.length >= 2) {
                            this.stats.cpu = parseFloat(parts[0]) || 0;
                            this.stats.memory = parseInt(parts[1]) || 0;
                        }
                    } catch (e) {
                        // Ignore
                    }
                }

                this.stats.uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
            } catch (e) {
                // Ignore monitoring errors
            }
        }, 5000);
    }

    _readModInfo(modPath) {
        const info = {
            id: null,
            name: null,
            description: null,
            version: null,
            url: null
        };

        // Check for mod.info
        const modInfoPath = path.join(modPath, 'mod.info');
        if (fs.existsSync(modInfoPath)) {
            try {
                const content = fs.readFileSync(modInfoPath, 'utf-8');
                const lines = content.split('\n');
                for (const line of lines) {
                    const [key, ...valueParts] = line.split('=');
                    const value = valueParts.join('=').trim();
                    switch (key.trim().toLowerCase()) {
                        case 'id':
                            info.id = value;
                            break;
                        case 'name':
                            info.name = value;
                            break;
                        case 'description':
                            info.description = value;
                            break;
                        case 'version':
                            info.version = value;
                            break;
                        case 'url':
                            info.url = value;
                            break;
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        // If no name found, use directory name
        if (!info.name) {
            info.name = path.basename(modPath);
        }
        if (!info.id) {
            info.id = path.basename(modPath);
        }

        return info;
    }

    _parseEnabledMods(configContent) {
        const mods = [];
        const lines = configContent.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith('mods=')) {
                const value = trimmed.split('=')[1]?.trim() || '';
                if (value) {
                    mods.push(...value.split(';').map(m => m.trim()).filter(Boolean));
                }
            }
            if (trimmed.toLowerCase().startsWith('workshopitems=')) {
                const value = trimmed.split('=')[1]?.trim() || '';
                if (value) {
                    mods.push(...value.split(';').map(m => m.trim()).filter(Boolean));
                }
            }
        }
        return mods;
    }

    cleanup() {
        if (this._statsInterval) {
            clearInterval(this._statsInterval);
            this._statsInterval = null;
        }
    }

    /**
     * Get item list from PZ game files (media/scripts/)
     * Returns array of { id: "Base.M249", module: "Base", name: "M249" }
     */
    getItemList() {
        const items = [];
        const scriptsDir = path.join(this.config.installPath, 'media', 'scripts');
        
        if (!fs.existsSync(scriptsDir)) {
            return items;
        }

        try {
            const files = fs.readdirSync(scriptsDir);
            for (const file of files) {
                if (!file.endsWith('.txt')) continue;
                const filePath = path.join(scriptsDir, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    this._parseScriptItems(content, items);
                } catch (e) {
                    // Skip unreadable files
                }
            }
        } catch (e) {
            // Scripts directory might not exist
        }

        // Sort alphabetically
        items.sort((a, b) => a.id.localeCompare(b.id));
        return items;
    }

    _parseScriptItems(content, items) {
        // Parse item definitions from script content
        // Format: module Base { items { item M249 { ... } } }
        // Combined item ID = Module.ItemName
        
        // Find all module blocks
        const moduleRegex = /module\s+(\w+)\s*\{/g;
        let moduleMatch;
        
        while ((moduleMatch = moduleRegex.exec(content)) !== null) {
            const moduleName = moduleMatch[1];
            const moduleStart = moduleMatch.index + moduleMatch[0].length;
            let depth = 1;
            let i = moduleStart;
            while (i < content.length && depth > 0) {
                if (content[i] === '{') depth++;
                else if (content[i] === '}') depth--;
                i++;
            }
            const moduleContent = content.substring(moduleStart, i - 1);
            
            // Find item definitions within this module
            const itemRegex = /^\s*item\s+(\w+)\s*$/gm;
            let itemMatch;
            while ((itemMatch = itemRegex.exec(moduleContent)) !== null) {
                const itemName = itemMatch[1];
                const fullId = moduleName + '.' + itemName;
                // Avoid duplicates
                if (!items.some(it => it.id === fullId)) {
                    items.push({
                        id: fullId,
                        module: moduleName,
                        name: itemName
                    });
                }
            }
        }
    }
}

module.exports = ServerManager;