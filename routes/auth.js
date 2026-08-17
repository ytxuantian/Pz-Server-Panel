const express = require('express');
const router = express.Router();
const crypto = require('crypto');

module.exports = function(config) {
    const sessions = new Map();

    // Generate session key
    function generateSessionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Login
    router.post('/api/login', (req, res) => {
        const { username, password } = req.body;
        
        if (username === config.auth.username && password === config.auth.password) {
            const sessionKey = generateSessionKey();
            const session = {
                key: sessionKey,
                username: username,
                createdAt: Date.now(),
                lastAccess: Date.now()
            };
            sessions.set(sessionKey, session);
            
            res.json({
                result: 1,
                session_key: sessionKey,
                message: '登录成功'
            });
        } else {
            res.json({
                result: 0,
                errcode: 7,
                message: '用户名或密码错误'
            });
        }
    });

    // GET login (for compatibility)
    router.get('/api/login', (req, res) => {
        const { username, password } = req.query;
        
        if (username === config.auth.username && password === config.auth.password) {
            const sessionKey = generateSessionKey();
            const session = {
                key: sessionKey,
                username: username,
                createdAt: Date.now(),
                lastAccess: Date.now()
            };
            sessions.set(sessionKey, session);
            
            res.json({
                result: 1,
                session_key: sessionKey,
                message: '登录成功'
            });
        } else {
            res.json({
                result: 0,
                errcode: 7,
                message: '用户名或密码错误'
            });
        }
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
    router.post('/api/change_password', (req, res) => {
        const { key, oldPassword, newPassword } = req.body;
        const session = sessions.get(key);
        
        if (!session) {
            return res.json({ result: 0, message: '会话已过期' });
        }

        if (oldPassword !== config.auth.password) {
            return res.json({ result: 0, message: '原密码错误' });
        }

        config.auth.password = newPassword;
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