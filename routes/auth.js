const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

module.exports = function(config) {
    const sessions = new Map();
    const configPath = path.join(__dirname, '..', 'config.json');

    // ── 启动时自动迁移明文密码为 bcrypt 哈希 ──
    function migratePasswordIfNeeded() {
        const pwd = config.auth.password;
        // bcrypt 哈希以 $2a$ 或 $2b$ 开头
        if (pwd && !pwd.startsWith('$2a$') && !pwd.startsWith('$2b$')) {
            const salt = bcrypt.genSaltSync(10);
            config.auth.password = bcrypt.hashSync(pwd, salt);
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                console.log('[auth] 已自动将明文密码迁移为 bcrypt 哈希');
            } catch (err) {
                console.error('[auth] 无法写入 config.json:', err.message);
            }
        }
    }
    migratePasswordIfNeeded();

    // 将 config 持久化到磁盘
    function persistConfig() {
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        } catch (err) {
            console.error('[auth] 无法写入 config.json:', err.message);
        }
    }

    // Generate session key
    function generateSessionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    // 验证密码（兼容明文 → bcrypt 过渡）
    async function verifyPassword(plaintext, stored) {
        if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
            return bcrypt.compare(plaintext, stored);
        }
        // 回退：明文比对（迁移前存量）
        return plaintext === stored;
    }

    // Login
    router.post('/api/login', async (req, res) => {
        const { username, password } = req.body;

        if (username === config.auth.username) {
            const ok = await verifyPassword(password, config.auth.password);
            if (ok) {
                const sessionKey = generateSessionKey();
                const session = {
                    key: sessionKey,
                    username: username,
                    createdAt: Date.now(),
                    lastAccess: Date.now()
                };
                sessions.set(sessionKey, session);

                return res.json({
                    result: 1,
                    session_key: sessionKey,
                    message: '登录成功'
                });
            }
        }
        res.json({
            result: 0,
            errcode: 7,
            message: '用户名或密码错误'
        });
    });

    // GET login (for compatibility)
    router.get('/api/login', async (req, res) => {
        const { username, password } = req.query;

        if (username === config.auth.username) {
            const ok = await verifyPassword(password, config.auth.password);
            if (ok) {
                const sessionKey = generateSessionKey();
                const session = {
                    key: sessionKey,
                    username: username,
                    createdAt: Date.now(),
                    lastAccess: Date.now()
                };
                sessions.set(sessionKey, session);

                return res.json({
                    result: 1,
                    session_key: sessionKey,
                    message: '登录成功'
                });
            }
        }
        res.json({
            result: 0,
            errcode: 7,
            message: '用户名或密码错误'
        });
    });

    // Logout
    router.post('/api/logout', (req, res) => {
        const { key } = req.body;
        sessions.delete(key);
        res.json({ result: 1, message: '已退出登录' });
    });

    // Check session validity
    router.get('/api/check_session', (req, res) => {
        const { key } = req.query;
        const session = sessions.get(key);

        if (session) {
            session.lastAccess = Date.now();
            res.json({ result: 1, username: session.username });
        } else {
            res.json({ result: 0, message: '会话已过期' });
        }
    });

    // Change password
    router.post('/api/change_password', async (req, res) => {
        const { key, oldPassword, newPassword } = req.body;
        const session = sessions.get(key);

        if (!session) {
            return res.json({ result: 0, message: '会话已过期' });
        }

        const ok = await verifyPassword(oldPassword, config.auth.password);
        if (!ok) {
            return res.json({ result: 0, message: '原密码错误' });
        }

        // 哈希新密码并持久化
        const salt = bcrypt.genSaltSync(10);
        config.auth.password = bcrypt.hashSync(newPassword, salt);
        persistConfig();

        // 让所有其他会话失效（强制重新登录）
        for (const [k, s] of sessions) {
            if (k !== key) sessions.delete(k);
        }

        res.json({ result: 1, message: '密码修改成功' });
    });

    // Middleware to check session
    router.checkSession = function(req, res, next) {
        const key = req.query.key || req.body.key;
        const session = sessions.get(key);

        if (session) {
            session.lastAccess = Date.now();
            req.session = session;
            next();
        } else {
            res.json({ result: 0, errcode: 7, message: '请先登录' });
        }
    };

    return router;
};