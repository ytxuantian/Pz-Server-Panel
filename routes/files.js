const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const MAX_TEXT_READ = 2 * 1024 * 1024; // 2MB，超过则提示下载
const VIEWABLE_EXTS = new Set([
    'txt', 'log', 'ini', 'cfg', 'conf', 'json', 'xml', 'yaml', 'yml', 'md', 'csv',
    'properties', 'lua', 'java', 'sql', 'bat', 'sh', 'cmd', 'js', 'ts', 'html', 'htm',
    'css', 'env', 'example', 'gitignore', 'sample', 'settings'
]);

module.exports = function(serverManager, checkSession) {
    function getRoot() {
        const root = serverManager.config.installPath;
        if (!root || !fs.existsSync(root)) {
            const err = new Error('未配置有效的 PZ 安装路径，请在系统设置中配置');
            err.code = 'NO_ROOT';
            throw err;
        }
        return path.resolve(root);
    }

    function safeResolve(root, rel) {
        const target = path.resolve(root, rel || '');
        const relPath = path.relative(root, target);
        if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
            throw new Error('非法路径');
        }
        return target;
    }

    function toRelative(root, full) {
        return path.relative(root, full).split(path.sep).join('/');
    }

    // List directory contents
    router.get('/api/files/list', checkSession, (req, res) => {
        try {
            const root = getRoot();
            const rel = req.query.path || '';
            const dir = safeResolve(root, rel);
            const stat = fs.statSync(dir);
            if (!stat.isDirectory()) {
                return res.json({ result: 0, message: '不是目录' });
            }

            const entries = fs.readdirSync(dir).map(name => {
                const full = path.join(dir, name);
                let st;
                try { st = fs.statSync(full); } catch (e) { return null; }
                const isDir = st.isDirectory();
                return {
                    name,
                    path: toRelative(root, full),
                    type: isDir ? 'dir' : 'file',
                    size: isDir ? null : st.size,
                    modified: st.mtime,
                    viewable: !isDir && st.size <= MAX_TEXT_READ && VIEWABLE_EXTS.has(path.extname(name).slice(1).toLowerCase())
                };
            }).filter(Boolean);

            entries.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            res.json({ result: 1, data: { root, current: rel, entries } });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Read text file content
    router.get('/api/files/read', checkSession, (req, res) => {
        try {
            const root = getRoot();
            const target = safeResolve(root, req.query.path || '');
            const stat = fs.statSync(target);
            if (!stat.isFile()) {
                return res.json({ result: 0, message: '不是文件' });
            }
            if (stat.size > MAX_TEXT_READ) {
                return res.json({ result: 0, message: '文件过大，请下载后查看' });
            }
            const content = fs.readFileSync(target, 'utf-8');
            res.json({
                result: 1,
                data: { path: req.query.path || '', content, size: stat.size, modified: stat.mtime }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Save text file (with backup)
    router.post('/api/files/save', checkSession, (req, res) => {
        try {
            const { path: relPath, content } = req.body;
            if (!relPath || content === undefined) {
                return res.json({ result: 0, message: '缺少参数' });
            }
            const root = getRoot();
            const target = safeResolve(root, relPath);
            const stat = fs.statSync(target);
            if (!stat.isFile()) {
                return res.json({ result: 0, message: '不是文件' });
            }
            if (stat.size > MAX_TEXT_READ) {
                return res.json({ result: 0, message: '文件过大，不支持在线编辑' });
            }

            const backupDir = path.join(root, 'config_backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
            const backupName = `${path.basename(relPath)}.${Date.now()}.bak`;
            fs.copyFileSync(target, path.join(backupDir, backupName));

            fs.writeFileSync(target, content, 'utf-8');
            res.json({ result: 1, data: { backup: backupName }, message: '文件已保存' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Delete file or directory
    router.post('/api/files/delete', checkSession, (req, res) => {
        try {
            const { path: relPath } = req.body;
            if (!relPath || relPath === '.') {
                return res.json({ result: 0, message: '不能删除根目录' });
            }
            const root = getRoot();
            const target = safeResolve(root, relPath);
            const stat = fs.statSync(target);
            if (stat.isDirectory()) {
                fs.rmSync(target, { recursive: true, force: true });
            } else {
                fs.unlinkSync(target);
            }
            res.json({ result: 1, message: '已删除' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Create directory
    router.post('/api/files/mkdir', checkSession, (req, res) => {
        try {
            const { path: relPath } = req.body;
            if (!relPath) {
                return res.json({ result: 0, message: '缺少目录名' });
            }
            const root = getRoot();
            const target = safeResolve(root, relPath);
            if (fs.existsSync(target)) {
                return res.json({ result: 0, message: '已存在同名文件或目录' });
            }
            fs.mkdirSync(target);
            res.json({ result: 1, message: '目录已创建' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Upload file (raw body)
    router.post('/api/files/upload', checkSession, express.raw({ type: 'application/octet-stream', limit: '1gb' }), (req, res) => {
        try {
            const dir = req.query.path || '';
            const name = req.query.name;
            if (!name) {
                return res.json({ result: 0, message: '缺少文件名' });
            }
            const root = getRoot();
            const rel = dir ? `${dir}/${name}` : name;
            const target = safeResolve(root, rel);
            fs.writeFileSync(target, req.body);
            res.json({ result: 1, message: '上传成功' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Download file
    router.get('/api/files/download', checkSession, (req, res) => {
        try {
            const root = getRoot();
            const target = safeResolve(root, req.query.path || '');
            const stat = fs.statSync(target);
            if (!stat.isFile()) {
                return res.json({ result: 0, message: '不是文件' });
            }
            res.download(target, path.basename(target));
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    return router;
};
