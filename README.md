# PZ Server Panel

**Project Zomboid 服务器管理面板** | 基于 Node.js + Express 的 Web 管理工具

> 参考 [NaiwaziBot](https://github.com/)（7 Days to Die 服务器管理面板）的设计思路，为 Project Zomboid 打造的全功能服务器管理面板。支持 Windows / Linux。

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 📊 **仪表盘** | 服务器状态、在线玩家、运行时间、游戏版本、系统信息（CPU/内存/OS） |
| 🖥 **服务器控制** | 启动/停止/重启服务器、交互式控制台、发送命令 |
| 👥 **玩家管理** | 在线玩家列表、发送消息、踢出/封禁、保存世界、给予物品 |
| 📁 **文件管理** | 浏览 PZ 安装目录、面包屑导航、文本查看/编辑（自动备份）、上传/下载、删除、新建文件夹 |
| ⚙ **配置管理** | 可视化配置编辑器（分类分组折叠、关键词搜索、修改跟踪/重置、中文说明、开关/下拉/数字/文本），支持切换到文本模式 |
| 🧩 **Mod 管理** | 显示本地/Steam 创意工坊 Mod，一键启用/禁用，支持从创意工坊 URL 添加 Mod |
| 🌍 **地图** | Leaflet 地图 + PZ 社区瓦片 + 玩家位置追踪（每 10 秒更新） |
| 📝 **日志查看** | 历史日志文件浏览、在线查看（自适应弹窗、级别着色） |
| 💾 **备份管理** | 创建/恢复/删除存档备份，支持自动定时备份 |
| 🔧 **系统设置** | 自动搜索 PZ 安装路径（多镜像下载 SteamCMD 自动安装）、保存路径、RCON 配置、备份参数、账户密码 |

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

### 文件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files/list` | 列出目录内容（仅限 PZ 安装目录内，含路径穿越防护） |
| GET | `/api/files/read` | 读取文本文件（>2MB 提示下载） |
| POST | `/api/files/save` | 保存文本文件（自动备份到 config_backups/） |
| POST | `/api/files/delete` | 删除文件/目录（递归） |
| POST | `/api/files/mkdir` | 新建文件夹 |
| POST | `/api/files/upload` | 上传文件（原始字节流） |
| GET | `/api/files/download` | 下载文件 |

### 游戏安装

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config/detect-pz` | 自动搜索 PZ 安装路径（扫描磁盘/Steam 库） |
| POST | `/api/config/install-pz` | 通过 SteamCMD 自动安装服务器（Windows/Linux） |
| GET | `/api/config/install-status` | 安装进度/实时日志 |

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
│   ├── config.js              # 配置文件编辑/安装 API
│   ├── mods.js                # Mod 管理 API
│   ├── logs.js                # 日志查看 API
│   ├── backups.js             # 备份管理 API
│   └── files.js               # 文件管理 API
└── public/
    ├── index.html              # 主管理面板
    ├── login.html              # 登录页面
    ├── config.html             # 配置文件页
    ├── files.html              # 文件管理页
    ├── players.html            # 玩家管理页
    ├── mods.html               # Mod 管理页
    ├── map.html                # 地图页
    ├── logs.html               # 日志查看页
    ├── backups.html            # 备份管理页
    ├── settings.html           # 系统设置页
    ├── bg.jpg                  # 背景图片
    ├── css/style.css           # 样式表
    └── js/
        ├── shared.js           # 共享工具（API/弹窗/Toast）
        └── pages/              # 各页面前端逻辑
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