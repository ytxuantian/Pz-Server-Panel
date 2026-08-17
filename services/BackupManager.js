const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class BackupManager {
    constructor(config) {
        this.config = config;
        this.backupPath = config.backup?.path || path.join(config.pzServer.installPath, '..', 'backups');
        this.maxBackups = config.backup?.maxBackups || 10;
        this.interval = (config.backup?.interval || 360) * 60 * 1000; // Convert minutes to ms
        this._timer = null;
    }

    getBackupInfo() {
        const savesDir = path.join(
            this.config.pzServer.installPath,
            'media',
            'saves'
        );

        const backups = [];
        if (fs.existsSync(this.backupPath)) {
            const items = fs.readdirSync(this.backupPath);
            for (const item of items) {
                const itemPath = path.join(this.backupPath, item);
                try {
                    const stat = fs.statSync(itemPath);
                    backups.push({
                        name: item,
                        path: itemPath,
                        size: this._getDirSize(itemPath),
                        created: stat.mtime,
                        type: stat.isDirectory() ? 'directory' : 'file'
                    });
                } catch (e) {
                    // Skip inaccessible items
                }
            }
        }

        backups.sort((a, b) => new Date(b.created) - new Date(a.created));

        return {
            backups,
            savesPath: savesDir,
            backupPath: this.backupPath,
            maxBackups: this.maxBackups,
            interval: this.config.backup?.interval || 360,
            enabled: this.config.backup?.enabled !== false
        };
    }

    createBackup(serverName) {
        const savesDir = path.join(
            this.config.pzServer.installPath,
            'media',
            'saves'
        );

        if (!fs.existsSync(savesDir)) {
            throw new Error('存档目录不存在: ' + savesDir);
        }

        if (!fs.existsSync(this.backupPath)) {
            fs.mkdirSync(this.backupPath, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `backup-${serverName || 'servertest'}-${timestamp}`;
        const backupDest = path.join(this.backupPath, backupName);

        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            let cmd, args;

            if (isWindows) {
                cmd = 'robocopy';
                args = [savesDir, backupDest, '/E', '/COPY:DAT', '/R:2', '/W:5', '/NFL', '/NDL', '/NJH', '/NJS'];
            } else {
                cmd = 'cp';
                args = ['-r', savesDir, backupDest];
            }

            const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let output = '';

            proc.stdout.on('data', (d) => { output += d.toString(); });
            proc.stderr.on('data', (d) => { output += d.toString(); });

            proc.on('close', (code) => {
                // robocopy: 0-7 are success
                if ((isWindows && (code === 0 || code === 1)) || (!isWindows && code === 0)) {
                    this._cleanupOldBackups();
                    resolve({ success: true, name: backupName, path: backupDest });
                } else {
                    reject(new Error(`备份失败，退出码: ${code}\n${output.slice(0, 500)}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`备份进程错误: ${err.message}`));
            });
        });
    }

    restoreBackup(backupName) {
        const backupSource = path.join(this.backupPath, backupName);
        const savesDir = path.join(
            this.config.pzServer.installPath,
            'media',
            'saves'
        );

        if (!fs.existsSync(backupSource)) {
            throw new Error('备份文件不存在: ' + backupSource);
        }

        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';

            // Remove current saves
            try {
                if (fs.existsSync(savesDir)) {
                    if (isWindows) {
                        require('child_process').execSync(`rmdir /S /Q "${savesDir}" 2>nul`);
                    } else {
                        require('child_process').execSync(`rm -rf "${savesDir}"`);
                    }
                }
            } catch (e) {
                // Ignore removal errors
            }

            // Ensure parent directory exists
            const savesParent = path.dirname(savesDir);
            if (!fs.existsSync(savesParent)) {
                fs.mkdirSync(savesParent, { recursive: true });
            }

            // Restore from backup
            let cmd, args;
            if (isWindows) {
                cmd = 'robocopy';
                args = [backupSource, savesDir, '/E', '/COPY:DAT', '/R:2', '/W:5', '/NFL', '/NDL', '/NJH', '/NJS'];
            } else {
                cmd = 'cp';
                args = ['-r', backupSource, savesDir];
            }

            const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

            proc.on('close', (code) => {
                if ((isWindows && (code === 0 || code === 1)) || (!isWindows && code === 0)) {
                    resolve({ success: true, name: backupName });
                } else {
                    reject(new Error(`恢复失败，退出码: ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`恢复进程错误: ${err.message}`));
            });
        });
    }

    deleteBackup(backupName) {
        const backupPath = path.join(this.backupPath, backupName);
        if (!fs.existsSync(backupPath)) {
            throw new Error('备份文件不存在');
        }

        const isWindows = process.platform === 'win32';
        try {
            if (isWindows) {
                require('child_process').execSync(`rmdir /S /Q "${backupPath}" 2>nul`);
            } else {
                require('child_process').execSync(`rm -rf "${backupPath}"`);
            }
            return { success: true };
        } catch (e) {
            throw new Error('删除备份失败: ' + e.message);
        }
    }

    startAutoBackup(serverName) {
        this.stopAutoBackup();
        if (this.config.backup?.enabled !== false) {
            console.log(`[BackupManager] 自动备份已启动，间隔: ${this.config.backup?.interval || 360} 分钟`);
            this._timer = setInterval(() => {
                this.createBackup(serverName)
                    .then((result) => {
                        console.log(`[BackupManager] 自动备份完成: ${result.name}`);
                    })
                    .catch((err) => {
                        console.error('[BackupManager] 自动备份失败:', err.message);
                    });
            }, this.interval);
        }
    }

    stopAutoBackup() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    _cleanupOldBackups() {
        try {
            if (!fs.existsSync(this.backupPath)) return;

            const items = fs.readdirSync(this.backupPath)
                .map(name => ({
                    name,
                    path: path.join(this.backupPath, name),
                    time: fs.statSync(path.join(this.backupPath, name)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            if (items.length > this.maxBackups) {
                const toDelete = items.slice(this.maxBackups);
                for (const item of toDelete) {
                    const isWindows = process.platform === 'win32';
                    try {
                        if (isWindows) {
                            require('child_process').execSync(`rmdir /S /Q "${item.path}" 2>nul`);
                        } else {
                            require('child_process').execSync(`rm -rf "${item.path}"`);
                        }
                        console.log(`[BackupManager] 已删除旧备份: ${item.name}`);
                    } catch (e) {
                        console.error(`[BackupManager] 删除旧备份失败: ${item.name}`, e.message);
                    }
                }
            }
        } catch (e) {
            console.error('[BackupManager] 清理旧备份失败:', e.message);
        }
    }

    cleanup() {
        this.stopAutoBackup();
    }
}

module.exports = BackupManager;