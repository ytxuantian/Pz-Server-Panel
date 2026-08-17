# PZ Server Panel

**Project Zomboid 服务器管理面板** | 基于 Node.js + Express 的 Web 管理工具

> 参考 [NaiwaziBot](https://github.com/)（7 Days to Die 服务器管理面板）的设计思路，为 Project Zomboid 打造的全功能服务器管理面板。支持 Windows / Linux。

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 📊 **仪表盘** | 服务器状态、在线玩家、运行时间、游戏版本、系统信息（CPU/内存/OS） |
| 🖥 **服务器控制** | 启动/停止/重启服务器、交互式控制台、发送命令 |
| 👥 **玩家管理** | 在线玩家列表、发送消息、踢出/封禁、保存世界 |
| ⚙ **配置管理** | 可视化配置编辑器（分类分组、中文说明、开关/下拉/数字/文本），支持切换到文本模式 |
| 🧩 **Mod 管理** | 显示本地/Steam 创意工坊 Mod，一键启用/禁用，支持从创意工坊 URL 添加 Mod |
| 🌍 **地图** | Leaflet 地图 + PZ 社区瓦片 + 玩家位置追踪（每 10 秒更新） |
| 📝 **日志查看** | 实时日志流、历史日志文件浏览、关键词搜索 |
| 💾 **备份管理** | 创建/恢复/删除存档备份，支持自动定时备份 |
| 🔧 **系统设置** | 自动搜索 PZ 安装路径、修改服务器路径、RCON 配置、备份参数、账户密码 |

---

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18.x
- [Project Zomboid 服务器](https://pzwiki.net/wiki/Dedicated_Server) 已安装
- 支持 Windows 和 Linux 系统

### 安装（Windows）

```bash
git clone https://github.com/ytxuantian/Pz-Server-Panel.git
cd Pz-Server-Panel
npm install
npm start
```

### 安装（Linux）

```bash
git clone https://github.com/ytxuantian/Pz-Server-Panel.git
cd Pz-Server-Panel
npm install
npm start
```

### 配置

首次启动后，在浏览器打开管理面板，进入 **系统设置**，点击 **「🔍 自动搜索」** 按钮，面板会自动扫描所有磁盘查找 PZ 安装路径。也可手动编辑 `config.json`。

### 访问

打开浏览器访问 **http://127.0.0.1:57873**

**默认登录：**
- 用户名：`admin`
- 密码：`admin123`

### 访问

打开浏览器访问 **http://127.0.0.1:57873**

**默认登录：**
- 用户名：`admin`
- 密码：`admin123`

---

## 配置说明

```json
{
  "port": 57873,
  "pzServer": {
    "installPath": "",
    "serverName": "servertest",
    "adminPassword": "changeme",
    "rconPort": 27015,
    "rconPassword": "changeme"
  },
  "backup": {
    "enabled": true,
    "interval": 360,
    "maxBackups": 10,
    "path": "backups"
  }
}
```

| 参数 | 说明 |
|------|------|
| `port` | 面板监听端口（默认 57873） |
| `pzServer.installPath` | PZ 服务器安装路径 |
| `pzServer.serverName` | 服务器名称（对应 `ServerName` 配置） |
| `pzServer.adminPassword` | 服务器管理员密码 |
| `pzServer.rconPort` | RCON 端口（默认 27015） |
| `pzServer.rconPassword` | RCON 密码 |
| `backup.enabled` | 是否启用自动备份 |
| `backup.interval` | 自动备份间隔（分钟） |
| `backup.maxBackups` | 最大备份保留数 |
| `backup.path` | 备份存储路径 |

---

## API 接口

所有 API 需携带 `?key={sessionKey}` 鉴权参数。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/login` | 登录认证 |
| POST | `/api/logout` | 退出登录 |
| GET | `/api/check_session` | 检查会话有效性 |

### 服务器管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/server/status` | 获取服务器状态 |
| POST | `/api/server/start` | 启动服务器 |
| POST | `/api/server/stop` | 停止服务器 |
| POST | `/api/server/restart` | 重启服务器 |
| POST | `/api/server/command` | 发送控制台命令 |
| GET | `/api/server/logs` | 获取服务器日志 |
| GET | `/api/server/stats` | 获取服务器统计数据 |
| GET | `/api/server/player-positions` | 获取玩家坐标 |

### 玩家管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/players/online` | 在线玩家列表 |
| GET | `/api/players/all` | 全部玩家列表 |
| POST | `/api/players/kick` | 踢出玩家 |
| POST | `/api/players/ban` | 封禁玩家 |
| POST | `/api/players/unban` | 解除封禁 |
| POST | `/api/players/message` | 发送私聊消息 |
| POST | `/api/players/teleport` | 传送玩家 |
| POST | `/api/players/giveitem` | 给予物品 |
| POST | `/api/players/saveall` | 保存所有玩家数据 |

### 配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config/list` | 配置文件列表 |
| GET | `/api/config/read` | 读取配置文件 |
| POST | `/api/config/save` | 保存配置文件 |
| GET | `/api/config/visual` | 获取可视化配置数据（含字段元数据） |
| POST | `/api/config/visual/save` | 保存可视化配置 |
| GET | `/api/config/settings` | 读取面板设置 |
| POST | `/api/config/settings` | 保存面板设置 |
| GET | `/api/config/detect-pz` | 自动搜索 PZ 安装路径（支持 Windows/Linux） |

### Mod 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mods/list` | Mod 列表 |
| POST | `/api/mods/enable` | 启用 Mod |
| POST | `/api/mods/disable` | 禁用 Mod |
| POST | `/api/mods/workshop/add` | 从创意工坊 URL/ID 添加 Mod |
| POST | `/api/mods/workshop/remove` | 移除 Workshop Mod |
| GET | `/api/mods/workshop/list` | 查看已配置的 Workshop Mod |

### 日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/logs/server` | 获取实时日志 |
| GET | `/api/logs/files` | 日志文件列表 |
| GET | `/api/logs/read` | 读取日志文件 |
| GET | `/api/logs/search` | 搜索日志 |
| POST | `/api/logs/clear` | 清空日志缓冲区 |

### 备份

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/backups/list` | 备份列表 |
| POST | `/api/backups/create` | 创建备份 |
| POST | `/api/backups/restore` | 恢复备份 |
| POST | `/api/backups/delete` | 删除备份 |
| POST | `/api/backups/auto` | 切换自动备份 |

---

## 项目结构

```
pz-server-panel/
├── server.js                  # Express 主服务器入口
├── config.json                # 面板配置文件
├── package.json               # 项目依赖
├── README.md                  # 项目文档
├── services/
│   ├── ServerManager.js       # PZ 服务器进程管理
│   ├── RconClient.js          # RCON 远程控制客户端
│   └── BackupManager.js       # 存档备份管理
├── routes/
│   ├── auth.js                # 登录/会话管理 API
│   ├── server.js              # 服务器启停/状态 API
│   ├── players.js             # 玩家管理 API
│   ├── config.js              # 配置文件编辑 API
│   ├── mods.js                # Mod 管理 API
│   ├── logs.js                # 日志查看 API
│   └── backups.js             # 备份管理 API
└── public/
    ├── index.html              # 主管理面板
    ├── login.html              # 登录页面
    ├── bg.jpg                  # 背景图片
    ├── css/style.css           # 样式表
    └── js/app.js               # 前端应用逻辑
```

---

## 许可证

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.