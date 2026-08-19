const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Known PZ server settings metadata for visual editor
const PZ_SETTINGS = {
    // Basic
    ServerName: { type: 'text', category: '基本设置', label: '服务器名称', desc: '服务器在列表中显示的名称' },
    ServerPassword: { type: 'password', category: '基本设置', label: '服务器密码', desc: '玩家加入服务器所需密码（留空则无密码）' },
    PublicName: { type: 'text', category: '基本设置', label: '公开名称', desc: '在服务器列表中显示的名称' },
    PublicDescription: { type: 'textarea', category: '基本设置', label: '公开描述', desc: '服务器描述信息' },
    MaxPlayers: { type: 'number', category: '基本设置', label: '最大玩家数', desc: '服务器最大同时在线玩家数', min: 1, max: 100 },
    PauseEmpty: { type: 'toggle', category: '基本设置', label: '无人时暂停', desc: '没有玩家在线时暂停游戏' },
    Open: { type: 'toggle', category: '基本设置', label: '公开服务器', desc: '是否在服务器列表中公开' },
    HideSteam: { type: 'toggle', category: '基本设置', label: '隐藏 Steam', desc: '从 Steam 服务器列表隐藏' },
    WorkshopItems: { type: 'text', category: '基本设置', label: 'Workshop Mod ID', desc: 'Steam 创意工坊 Mod ID（分号分隔）' },
    Mods: { type: 'text', category: '基本设置', label: 'Mod ID', desc: 'Mod 内部 ID（分号分隔）' },

    // Server
    DefaultPort: { type: 'number', category: '网络设置', label: '默认端口', desc: '服务器端口', min: 1, max: 65535 },
    UDPPort: { type: 'number', category: '网络设置', label: 'UDP 端口', desc: 'Steam UDP 端口', min: 1, max: 65535 },
    SteamPort: { type: 'number', category: '网络设置', label: 'Steam 端口', desc: 'Steam 通信端口', min: 1, max: 65535 },
    SteamVAC: { type: 'toggle', category: '网络设置', label: 'Steam VAC 反作弊', desc: '启用 Steam VAC 反作弊' },
    RCOnPort: { type: 'number', category: '网络设置', label: 'RCON 端口', desc: '远程控制端口', min: 1, max: 65535 },
    RCOnPassword: { type: 'password', category: '网络设置', label: 'RCON 密码', desc: '远程控制密码' },

    // Gameplay
    DayLength: { type: 'select', category: '游戏设置', label: '白天时长', desc: '游戏内一天的时间长度', options: [{value:'1',label:'1小时'},{value:'2',label:'2小时'},{value:'3',label:'3小时'},{value:'4',label:'4小时'},{value:'5',label:'5小时'},{value:'6',label:'6小时'},{value:'7',label:'7小时'},{value:'8',label:'8小时'},{value:'9',label:'9小时'},{value:'10',label:'10小时'},{value:'11',label:'11小时'},{value:'12',label:'12小时'}] },
    StartMonth: { type: 'number', category: '游戏设置', label: '开始月份', desc: '游戏开始的月份（1-12）', min: 1, max: 12 },
    StartDay: { type: 'number', category: '游戏设置', label: '开始日期', desc: '游戏开始的日期（1-28）', min: 1, max: 28 },
    StartTime: { type: 'number', category: '游戏设置', label: '开始时间', desc: '游戏开始的小时（0-23）', min: 0, max: 23 },
    WaterShut: { type: 'number', category: '游戏设置', label: '断水天数', desc: '游戏开始后断水的天数（-1=不断水）', min: -1, max: 365 },
    ElecShut: { type: 'number', category: '游戏设置', label: '断电天数', desc: '游戏开始后断电的天数（-1=不断电）', min: -1, max: 365 },
    FoodRotSpeed: { type: 'number', category: '游戏设置', label: '食物腐烂速度', desc: '食物腐烂速度倍数', min: 0.0, max: 10.0, step: 0.1 },
    ZombieAttractionMultiplier: { type: 'number', category: '游戏设置', label: '僵尸吸引倍数', desc: '僵尸吸引范围倍数', min: 0.0, max: 10.0, step: 0.1 },
    ConstructionPreventsZombSpawns: { type: 'toggle', category: '游戏设置', label: '建筑阻止僵尸刷新', desc: '玩家建筑区域阻止僵尸刷新' },
    Temperature: { type: 'toggle', category: '游戏设置', label: '温度系统', desc: '启用温度系统' },
    Rain: { type: 'toggle', category: '游戏设置', label: '降雨', desc: '启用降雨' },
    Erosion: { type: 'toggle', category: '游戏设置', label: '侵蚀', desc: '启用环境侵蚀' },
    Faction: { type: 'toggle', category: '游戏设置', label: '阵营系统', desc: '启用阵营系统' },
    Map: { type: 'text', category: '游戏设置', label: '地图', desc: '加载的地图（分号分隔）' },

    // Zombie
    ZombieLore: { type: 'select', category: '僵尸设置', label: '僵尸设定', desc: '僵尸设定预设', options: [{value:'Default',label:'默认'},{value:'Builder',label:'建造者'},{value:'Survivor',label:'幸存者'},{value:'SixMonths',label:'六个月后'},{value:'Apocalypse',label:'天启'},{value:'Nightmare',label:'噩梦'},{value:'Custom',label:'自定义'}] },
    PopulationMultiplier: { type: 'number', category: '僵尸设置', label: '人口倍数', desc: '僵尸人口倍数', min: 0.0, max: 10.0, step: 0.1 },
    PopulationStartMultiplier: { type: 'number', category: '僵尸设置', label: '初始人口倍数', desc: '游戏开始时僵尸人口倍数', min: 0.0, max: 10.0, step: 0.1 },
    PopulationPeakMultiplier: { type: 'number', category: '僵尸设置', label: '峰值人口倍数', desc: '僵尸人口峰值倍数', min: 0.0, max: 10.0, step: 0.1 },
    PopulationPeakDay: { type: 'number', category: '僵尸设置', label: '峰值天数', desc: '达到僵尸人口峰值的天数', min: 1, max: 365 },
    RespawnHours: { type: 'number', category: '僵尸设置', label: '刷新间隔', desc: '僵尸刷新间隔（小时）', min: 0.0, max: 8760, step: 0.1 },
    RespawnMultiplier: { type: 'number', category: '僵尸设置', label: '刷新倍数', desc: '僵尸刷新数量倍数', min: 0.0, max: 10.0, step: 0.1 },
    RespawnUnseenHours: { type: 'number', category: '僵尸设置', label: '刷新可见时间', desc: '玩家离开后多久可刷新僵尸（小时）', min: 0.0, max: 8760, step: 0.1 },
    ZombieSpeed: { type: 'select', category: '僵尸设置', label: '僵尸速度', desc: '僵尸移动速度', options: [{value:'Normal',label:'正常'},{value:'Fast',label:'快速'},{value:'Random',label:'随机'}] },
    ZombieStrength: { type: 'select', category: '僵尸设置', label: '僵尸力量', desc: '僵尸攻击力', options: [{value:'Normal',label:'正常'},{value:'Strong',label:'强壮'},{value:'Random',label:'随机'}] },
    ZombieToughness: { type: 'select', category: '僵尸设置', label: '僵尸韧性', desc: '僵尸生命值', options: [{value:'Normal',label:'正常'},{value:'Tough',label:'坚韧'},{value:'Random',label:'随机'}] },
    ZombieTransmission: { type: 'select', category: '僵尸设置', label: '感染方式', desc: '病毒感染传播方式', options: [{value:'Saliva',label:'唾液'},{value:'Blood',label:'血液'},{value:'Everyone',label:'所有人'},{value:'None',label:'无'}] },
    RallyGroupSize: { type: 'number', category: '僵尸设置', label: '集结群组大小', desc: '僵尸集结群组大小', min: 1, max: 1000 },
    RallyTravelDistance: { type: 'number', category: '僵尸设置', label: '集结移动距离', desc: '僵尸集结移动距离', min: 0, max: 100 },

    // Loot
    LootRespawn: { type: 'toggle', category: '战利品设置', label: '战利品刷新', desc: '启用战利品刷新' },
    LootRespawnHours: { type: 'number', category: '战利品设置', label: '战利品刷新间隔', desc: '战利品刷新间隔（小时）', min: 0, max: 8760 },
    HoursForLootRespawn: { type: 'number', category: '战利品设置', label: '战利品刷新时间', desc: '战利品刷新所需时间（小时）', min: 0, max: 8760 },
    LootAbundance: { type: 'select', category: '战利品设置', label: '战利品丰富度', desc: '战利品数量', options: [{value:'Default',label:'默认'},{value:'Poor',label:'贫乏'},{value:'Normal',label:'正常'},{value:'Abundant',label:'丰富'}] },

    // PVP
    PVP: { type: 'toggle', category: 'PVP 设置', label: '启用 PVP', desc: '允许玩家间互相攻击' },
    PVPMelee: { type: 'toggle', category: 'PVP 设置', label: '近战 PVP', desc: '允许近战 PVP' },
    PVPFirearms: { type: 'toggle', category: 'PVP 设置', label: '枪械 PVP', desc: '允许枪械 PVP' },
    SafeZone: { type: 'toggle', category: 'PVP 设置', label: '安全区', desc: '启用安全区' },
    SafeZoneX: { type: 'number', category: 'PVP 设置', label: '安全区 X', desc: '安全区中心 X 坐标' },
    SafeZoneY: { type: 'number', category: 'PVP 设置', label: '安全区 Y', desc: '安全区中心 Y 坐标' },
    SafeZoneRadius: { type: 'number', category: 'PVP 设置', label: '安全区半径', desc: '安全区半径' },

    // Economy
    Economy: { type: 'toggle', category: '经济设置', label: '经济系统', desc: '启用经济系统' },
    StarterKit: { type: 'text', category: '经济设置', label: '新手包', desc: '新玩家初始物品' },
    StarterKitItems: { type: 'text', category: '经济设置', label: '新手包物品', desc: '新玩家初始物品列表' },
    HoursForPlayer: { type: 'number', category: '经济设置', label: '玩家时间', desc: '玩家游戏时间统计' },

    // Admin
    AccessLevel: { type: 'select', category: '管理设置', label: '访问权限', desc: '默认玩家访问权限', options: [{value:'None',label:'无'},{value:'Observer',label:'观察者'},{value:'Moderator',label:'管理员'},{value:'Admin',label:'超级管理员'}] },
    NoFire: { type: 'toggle', category: '管理设置', label: '禁止火焰', desc: '禁止使用火焰武器' },
    DenyLogin: { type: 'textarea', category: '管理设置', label: '禁止登录', desc: '禁止特定用户登录' },
    Whitelist: { type: 'toggle', category: '管理设置', label: '白名单', desc: '启用白名单模式' },
    AntiCheat: { type: 'toggle', category: '管理设置', label: '反作弊', desc: '启用内置反作弊' },
    AntiCheatLog: { type: 'toggle', category: '管理设置', label: '反作弊日志', desc: '记录反作弊日志' },
    SpeedLimit: { type: 'number', category: '管理设置', label: '速度限制', desc: '玩家最大速度限制' },
    PlayerRespawnTime: { type: 'number', category: '管理设置', label: '重生时间', desc: '玩家重生等待时间（秒）' },

    // Misc
    DisplayUserName: { type: 'toggle', category: '其他', label: '显示用户名', desc: '在游戏中显示玩家用户名' },
    ShowPlayerOnMap: { type: 'toggle', category: '其他', label: '地图显示玩家', desc: '在地图上显示玩家位置' },
    ShowPlayerNames: { type: 'toggle', category: '其他', label: '显示玩家名称', desc: '在玩家头上显示名称' },
    SleepAllowed: { type: 'toggle', category: '其他', label: '允许睡觉', desc: '允许玩家睡觉跳过夜晚' },
    SleepNeeded: { type: 'toggle', category: '其他', label: '需要睡觉', desc: '玩家需要睡觉' },
    Trash: { type: 'toggle', category: '其他', label: '垃圾系统', desc: '启用垃圾系统' },
    TrashDeleteAll: { type: 'toggle', category: '其他', label: '自动清理垃圾', desc: '自动删除地面垃圾' },
    HoursForTrashDeleteAll: { type: 'number', category: '其他', label: '垃圾清理间隔', desc: '垃圾自动清理间隔（小时）' },
    AllowDestruction: { type: 'toggle', category: '其他', label: '允许破坏', desc: '允许玩家破坏环境' },
    AllowDestructionBySledgehammer: { type: 'toggle', category: '其他', label: '允许大锤破坏', desc: '允许使用大锤破坏' },
    AnnounceDeath: { type: 'toggle', category: '其他', label: '公告死亡', desc: '在聊天中公告玩家死亡' },
    BloodSplat: { type: 'toggle', category: '其他', label: '血迹', desc: '启用血迹效果' },
    ClothingDegradation: { type: 'toggle', category: '其他', label: '衣物磨损', desc: '启用衣物磨损系统' },
    WeaponDamage: { type: 'toggle', category: '其他', label: '武器损坏', desc: '启用武器损坏系统' },
    PlayerStats: { type: 'toggle', category: '其他', label: '玩家统计', desc: '记录玩家统计信息' },
    Voice: { type: 'toggle', category: '其他', label: '语音系统', desc: '启用内置语音系统' },
    VoiceChannels: { type: 'number', category: '其他', label: '语音频道数', desc: '语音频道数量', min: 1, max: 100 },
    Coop: { type: 'toggle', category: '其他', label: '合作模式', desc: '启用合作模式' },
    PlayerBumpPlayer: { type: 'toggle', category: '其他', label: '玩家碰撞', desc: '启用玩家碰撞' },
    DisableRadio: { type: 'toggle', category: '其他', label: '禁用收音机', desc: '禁用收音机系统' },
    DisableHordes: { type: 'toggle', category: '其他', label: '禁用尸潮', desc: '禁用僵尸尸潮' },
    DisableStories: { type: 'toggle', category: '其他', label: '禁用事件', desc: '禁用随机事件' },
    ServerPlayerID: { type: 'text', category: '其他', label: '服务器 ID', desc: '服务器唯一标识' },
    GUID: { type: 'text', category: '其他', label: 'GUID', desc: '服务器全局唯一标识' },

    // === 更多僵尸设置 ===
    ZombieSpeed: { type: 'select', category: '僵尸设置', label: '僵尸速度', desc: '僵尸移动速度', options: [{value:'Normal',label:'正常'},{value:'Fast',label:'快速'},{value:'Random',label:'随机'}] },
    ZombieCognition: { type: 'select', category: '僵尸设置', label: '僵尸认知', desc: '僵尸感知能力', options: [{value:'Normal',label:'正常'},{value:'Basic',label:'基础'},{value:'Navigation',label:'导航'},{value:'Random',label:'随机'}] },
    ZombieHearing: { type: 'select', category: '僵尸设置', label: '僵尸听觉', desc: '僵尸听觉范围', options: [{value:'Normal',label:'正常'},{value:'Poor',label:'差'},{value:'Pinpoint',label:'精准'},{value:'Random',label:'随机'}] },
    ZombieSight: { type: 'select', category: '僵尸设置', label: '僵尸视觉', desc: '僵尸视觉范围', options: [{value:'Normal',label:'正常'},{value:'Poor',label:'差'},{value:'Pinpoint',label:'精准'},{value:'Random',label:'随机'}] },
    ZombieMemory: { type: 'select', category: '僵尸设置', label: '僵尸记忆', desc: '僵尸记忆时长', options: [{value:'Normal',label:'正常'},{value:'Short',label:'短暂'},{value:'Long',label:'长久'},{value:'Random',label:'随机'}] },
    ZombieThumpNoise: { type: 'select', category: '僵尸设置', label: '僵尸砸门噪音', desc: '僵尸砸门噪音大小', options: [{value:'Normal',label:'正常'},{value:'Loud',label:'大声'},{value:'Random',label:'随机'}] },
    ZombieThumpPower: { type: 'select', category: '僵尸设置', label: '僵尸砸门力度', desc: '僵尸砸门破坏力', options: [{value:'Normal',label:'正常'},{value:'Strong',label:'强壮'},{value:'Random',label:'随机'}] },
    ZombieDragRed: { type: 'toggle', category: '僵尸设置', label: '僵尸拖拽', desc: '僵尸可以拖拽玩家' },
    ZombieFenceJump: { type: 'select', category: '僵尸设置', label: '僵尸跳围栏', desc: '僵尸跳过围栏能力', options: [{value:'Normal',label:'正常'},{value:'None',label:'无'},{value:'Random',label:'随机'}] },
    ZombieMoveType: { type: 'select', category: '僵尸设置', label: '僵尸移动类型', desc: '僵尸移动方式', options: [{value:'Normal',label:'正常'},{value:'CanWalk',label:'只能走'},{value:'CanRun',label:'只能跑'},{value:'Random',label:'随机'}] },
    NatureAbundance: { type: 'select', category: '僵尸设置', label: '自然环境丰富度', desc: '自然环境物品丰富度', options: [{value:'Default',label:'默认'},{value:'Poor',label:'贫乏'},{value:'Normal',label:'正常'},{value:'Abundant',label:'丰富'}] },
    HoursForCorpseDespawn: { type: 'number', category: '僵尸设置', label: '尸体消失时间', desc: '尸体消失所需小时数', min: 0, max: 8760 },
    MaxZombiesPerCell: { type: 'number', category: '僵尸设置', label: '每区最大僵尸', desc: '每个区域最大僵尸数量', min: 0, max: 1000 },
    ZombieRespawn: { type: 'toggle', category: '僵尸设置', label: '僵尸刷新', desc: '启用僵尸刷新' },
    ZombieRespawnHours: { type: 'number', category: '僵尸设置', label: '僵尸刷新间隔', desc: '僵尸刷新间隔（小时）', min: 0, max: 8760 },
    HoursForZombieRespawn: { type: 'number', category: '僵尸设置', label: '僵尸刷新时间', desc: '僵尸刷新所需时间（小时）', min: 0, max: 8760 },
    PopulationStartMultiplier: { type: 'number', category: '僵尸设置', label: '起始人口倍数', desc: '游戏开始时僵尸人口倍数', min: 0.0, max: 10.0, step: 0.1 },
    PopulationPeakMultiplier: { type: 'number', category: '僵尸设置', label: '峰值人口倍数', desc: '僵尸人口峰值倍数', min: 0.0, max: 10.0, step: 0.1 },
    PopulationPeakDay: { type: 'number', category: '僵尸设置', label: '峰值天数', desc: '达到僵尸人口峰值的天数', min: 0, max: 365 },
    RespawnMultiplier: { type: 'number', category: '僵尸设置', label: '刷新倍数', desc: '僵尸刷新速度倍数', min: 0.0, max: 10.0, step: 0.1 },
    RespawnPeakMultiplier: { type: 'number', category: '僵尸设置', label: '刷新峰值倍数', desc: '僵尸刷新峰值倍数', min: 0.0, max: 10.0, step: 0.1 },
    RespawnPeakDay: { type: 'number', category: '僵尸设置', label: '刷新峰值天数', desc: '达到刷新峰值的天数', min: 0, max: 365 },
    RespawnUnseenHours: { type: 'number', category: '僵尸设置', label: '刷新不可见时间', desc: '玩家离开后多久刷新僵尸（小时）', min: 0, max: 8760 },

    // === 更多战利品设置 ===
    MaxItemsPerContainer: { type: 'number', category: '战利品设置', label: '容器最大物品数', desc: '每个容器最大物品数量', min: 0, max: 1000 },
    MaxGunClubLoot: { type: 'number', category: '战利品设置', label: '枪店最大战利品', desc: '枪店最大战利品数量', min: 0, max: 1000 },
    MaxMaggots: { type: 'number', category: '战利品设置', label: '最大蛆虫数', desc: '食物上最大蛆虫数量', min: 0, max: 1000 },
    ClothingDegradationRate: { type: 'number', category: '战利品设置', label: '衣物磨损速度', desc: '衣物磨损速度倍数', min: 0.0, max: 10.0, step: 0.1 },
    ContainerTooltip: { type: 'toggle', category: '战利品设置', label: '容器提示', desc: '显示容器内容提示' },
    ContainerTooltipNumber: { type: 'number', category: '战利品设置', label: '容器提示数量', desc: '容器提示显示最大物品数', min: 0, max: 100 },
    WorldItemRemovalList: { type: 'text', category: '战利品设置', label: '世界物品移除列表', desc: '自动移除的地面物品列表（逗号分隔）' },
    HoursForWorldItemRemoval: { type: 'number', category: '战利品设置', label: '物品移除时间', desc: '地面物品自动移除时间（小时）', min: 0, max: 8760 },
    ItemRemovalList: { type: 'text', category: '战利品设置', label: '物品移除列表', desc: '自动移除的物品列表（逗号分隔）' },
    HoursForItemRemoval: { type: 'number', category: '战利品设置', label: '物品移除间隔', desc: '物品自动移除间隔（小时）', min: 0, max: 8760 },
    MaxItemsForContainerTooltip: { type: 'number', category: '战利品设置', label: '提示最大物品数', desc: '容器提示显示的最大物品数', min: 0, max: 100 },

    // === 更多 PVP 设置 ===
    PVPBomb: { type: 'toggle', category: 'PVP 设置', label: '爆炸 PVP', desc: '允许爆炸伤害玩家' },
    PVPBombDamage: { type: 'number', category: 'PVP 设置', label: '爆炸伤害', desc: '爆炸对玩家伤害倍数', min: 0.0, max: 10.0, step: 0.1 },
    SafeZoneNoPvP: { type: 'toggle', category: 'PVP 设置', label: '安全区禁止 PVP', desc: '安全区内禁止 PVP' },
    SafeZoneNoFire: { type: 'toggle', category: 'PVP 设置', label: '安全区禁止开火', desc: '安全区内禁止开火' },
    SafeZoneNoWeapon: { type: 'toggle', category: 'PVP 设置', label: '安全区禁止武器', desc: '安全区内禁止使用武器' },
    SafeZoneNoLoot: { type: 'toggle', category: 'PVP 设置', label: '安全区禁止搜刮', desc: '安全区内禁止搜刮' },
    SafeZoneNoAmmo: { type: 'toggle', category: 'PVP 设置', label: '安全区禁止弹药', desc: '安全区内禁止使用弹药' },
    SafeZoneNoZombie: { type: 'toggle', category: 'PVP 设置', label: '安全区无僵尸', desc: '安全区内禁止僵尸出现' },
    SafeZoneNoZombieSpawn: { type: 'toggle', category: 'PVP 设置', label: '安全区无僵尸刷新', desc: '安全区内禁止僵尸刷新' },

    // === 更多经济设置 ===
    StarterKitPoints: { type: 'number', category: '经济设置', label: '新手点数', desc: '新玩家初始点数', min: 0, max: 100000 },
    EconomyDay: { type: 'number', category: '经济设置', label: '经济结算日', desc: '经济系统结算日间隔', min: 1, max: 365 },
    EconomyHours: { type: 'number', category: '经济设置', label: '经济结算小时', desc: '经济系统结算小时数', min: 1, max: 8760 },
    EconomyPoints: { type: 'number', category: '经济设置', label: '经济点数', desc: '经济系统初始点数', min: 0, max: 100000 },
    EconomyPointsPerHour: { type: 'number', category: '经济设置', label: '每小时点数', desc: '每小时获得的经济点数', min: 0, max: 10000 },
    EconomyPointsPerDay: { type: 'number', category: '经济设置', label: '每天点数', desc: '每天获得的经济点数', min: 0, max: 10000 },
    EconomyPointsPerKill: { type: 'number', category: '经济设置', label: '击杀点数', desc: '每击杀僵尸获得点数', min: 0, max: 10000 },
    EconomyPointsPerPlayerKill: { type: 'number', category: '经济设置', label: '玩家击杀点数', desc: '每击杀玩家获得点数', min: 0, max: 10000 },
    EconomyPointsPerZombieKill: { type: 'number', category: '经济设置', label: '僵尸击杀点数', desc: '每击杀僵尸获得点数', min: 0, max: 10000 },
    EconomyPointsPerSurvivorKill: { type: 'number', category: '经济设置', label: '幸存者击杀点数', desc: '每击杀幸存者获得点数', min: 0, max: 10000 },
    EconomyPointsPerZombie: { type: 'number', category: '经济设置', label: '僵尸点数', desc: '每僵尸点数', min: 0, max: 10000 },

    // === 更多管理设置 ===
    BanList: { type: 'textarea', category: '管理设置', label: '封禁列表', desc: '被封禁的玩家列表' },
    WhitelistFile: { type: 'text', category: '管理设置', label: '白名单文件', desc: '白名单文件路径' },
    DenyLoginFile: { type: 'text', category: '管理设置', label: '禁止登录文件', desc: '禁止登录文件路径' },
    KickFile: { type: 'text', category: '管理设置', label: '踢出文件', desc: '踢出玩家文件路径' },
    KickPlayers: { type: 'textarea', category: '管理设置', label: '踢出列表', desc: '被踢出的玩家列表' },
    AntiCheatKick: { type: 'toggle', category: '管理设置', label: '反作弊踢出', desc: '反作弊检测到违规时踢出玩家' },
    AntiCheatBan: { type: 'toggle', category: '管理设置', label: '反作弊封禁', desc: '反作弊检测到违规时封禁玩家' },
    AntiCheatKickMessage: { type: 'text', category: '管理设置', label: '反作弊踢出消息', desc: '反作弊踢出时显示的消息' },
    AntiCheatBanMessage: { type: 'text', category: '管理设置', label: '反作弊封禁消息', desc: '反作弊封禁时显示的消息' },
    AntiCheatLogFile: { type: 'text', category: '管理设置', label: '反作弊日志文件', desc: '反作弊日志文件路径' },
    SpeedLimitKick: { type: 'toggle', category: '管理设置', label: '速度限制踢出', desc: '速度超过限制时踢出玩家' },
    SpeedLimitBan: { type: 'toggle', category: '管理设置', label: '速度限制封禁', desc: '速度超过限制时封禁玩家' },
    SpeedLimitKickMessage: { type: 'text', category: '管理设置', label: '速度限制踢出消息', desc: '速度限制踢出时显示的消息' },
    SpeedLimitBanMessage: { type: 'text', category: '管理设置', label: '速度限制封禁消息', desc: '速度限制封禁时显示的消息' },
    PlayerRespawnTimeMin: { type: 'number', category: '管理设置', label: '最小重生时间', desc: '玩家最小重生等待时间（秒）', min: 0, max: 86400 },
    PlayerRespawnTimeMax: { type: 'number', category: '管理设置', label: '最大重生时间', desc: '玩家最大重生等待时间（秒）', min: 0, max: 86400 },

    // === 更多其他设置 ===
    FactionDay: { type: 'number', category: '其他', label: '阵营创建天数', desc: '创建阵营所需游戏天数', min: 1, max: 365 },
    FactionPlayers: { type: 'number', category: '其他', label: '阵营最少玩家', desc: '创建阵营最少玩家数', min: 1, max: 100 },
    FactionPoints: { type: 'number', category: '其他', label: '阵营点数', desc: '阵营初始点数', min: 0, max: 100000 },
    FactionPointsPerDay: { type: 'number', category: '其他', label: '阵营每日点数', desc: '阵营每天获得点数', min: 0, max: 10000 },
    FactionPointsPerKill: { type: 'number', category: '其他', label: '阵营击杀点数', desc: '阵营每击杀获得点数', min: 0, max: 10000 },
    SleepNeededHours: { type: 'number', category: '其他', label: '睡眠需求小时', desc: '玩家需要睡眠的小时数', min: 0, max: 24 },
    SleepNeededTime: { type: 'number', category: '其他', label: '睡眠需求时间', desc: '玩家需要睡眠的时间', min: 0, max: 24 },
    SleepAllowedTime: { type: 'number', category: '其他', label: '允许睡眠时间', desc: '允许睡眠的时间', min: 0, max: 24 },
    SleepAllowedHours: { type: 'number', category: '其他', label: '允许睡眠小时', desc: '允许睡眠的小时数', min: 0, max: 24 },
    VoiceRange: { type: 'number', category: '其他', label: '语音范围', desc: '语音通信最大距离', min: 0, max: 1000 },
    VoiceVolume: { type: 'number', category: '其他', label: '语音音量', desc: '语音通信音量', min: 0, max: 100 },
    VoiceQuality: { type: 'number', category: '其他', label: '语音质量', desc: '语音通信质量', min: 0, max: 100 },
    Voice3D: { type: 'toggle', category: '其他', label: '3D 语音', desc: '启用 3D 语音效果' },
    Voice3DRange: { type: 'number', category: '其他', label: '3D 语音范围', desc: '3D 语音最大距离', min: 0, max: 1000 },
    RadioChannels: { type: 'number', category: '其他', label: '无线电频道数', desc: '无线电频道数量', min: 1, max: 100 },
    RadioRange: { type: 'number', category: '其他', label: '无线电范围', desc: '无线电通信范围', min: 0, max: 10000 },
    RadioVolume: { type: 'number', category: '其他', label: '无线电音量', desc: '无线电音量', min: 0, max: 100 },
    RadioQuality: { type: 'number', category: '其他', label: '无线电质量', desc: '无线电通信质量', min: 0, max: 100 },
    Radio3D: { type: 'toggle', category: '其他', label: '3D 无线电', desc: '启用 3D 无线电效果' },
    Radio3DRange: { type: 'number', category: '其他', label: '3D 无线电范围', desc: '3D 无线电最大距离', min: 0, max: 10000 },
    RadioInterference: { type: 'toggle', category: '其他', label: '无线电干扰', desc: '启用无线电干扰' },
    RadioInterferenceRange: { type: 'number', category: '其他', label: '无线电干扰范围', desc: '无线电干扰范围', min: 0, max: 10000 },
    RadioInterferenceStrength: { type: 'number', category: '其他', label: '无线电干扰强度', desc: '无线电干扰强度', min: 0, max: 100 },
    DisableRadioStatic: { type: 'toggle', category: '其他', label: '禁用无线电杂音', desc: '禁用无线电杂音效果' },
    DisableRadioHiss: { type: 'toggle', category: '其他', label: '禁用无线电嘶嘶', desc: '禁用无线电嘶嘶声' },
    DisableRadioWhine: { type: 'toggle', category: '其他', label: '禁用无线电嗡鸣', desc: '禁用无线电嗡鸣声' },
};

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

    // Auto-detect PZ installation path (Windows + Linux)
    router.get('/api/config/detect-pz', checkSession, (req, res) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const isWindows = process.platform === 'win32';

            const results = [];
            const checked = new Set();
            const steamPaths = [];

            if (isWindows) {
                // Windows: scan all drives for Steam
                const drives = [];
                for (let c = 'C'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
                    const drive = String.fromCharCode(c) + ':\\';
                    try { if (fs.existsSync(drive)) drives.push(drive); } catch (e) { }
                }
                for (const drive of drives) {
                    steamPaths.push(path.join(drive, 'Program Files (x86)', 'Steam'));
                    steamPaths.push(path.join(drive, 'Program Files', 'Steam'));
                    steamPaths.push(path.join(drive, 'Steam'));
                    steamPaths.push(path.join(drive, 'SteamLibrary'));
                    steamPaths.push(path.join(drive, 'Games', 'Steam'));
                }
                const defaultPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';
                if (fs.existsSync(defaultPath)) {
                    results.push({ path: defaultPath, source: 'Windows 默认路径' });
                }
            } else {
                // Linux: scan common Steam locations
                const home = os.homedir();
                steamPaths.push(path.join(home, '.steam', 'steam'));
                steamPaths.push(path.join(home, '.steam'));
                steamPaths.push(path.join(home, 'Steam'));
                steamPaths.push(path.join(home, '.local', 'share', 'Steam'));
                steamPaths.push('/usr/share/steam');
                steamPaths.push('/opt/steam');

                // Also check common PZ server install paths
                const linuxDefaultPaths = [
                    path.join(home, '.steam', 'steam', 'steamapps', 'common', 'ProjectZomboid'),
                    path.join(home, 'Steam', 'steamapps', 'common', 'ProjectZomboid'),
                    path.join(home, '.local', 'share', 'Steam', 'steamapps', 'common', 'ProjectZomboid'),
                    '/opt/pz-server',
                    '/srv/pz-server',
                ];
                for (const p of linuxDefaultPaths) {
                    if (fs.existsSync(p) && !results.find(r => r.path === p)) {
                        const hasMedia = fs.existsSync(path.join(p, 'media'));
                        const hasExe = fs.existsSync(path.join(p, 'ProjectZomboidServer')) ||
                                       fs.existsSync(path.join(p, 'start-server.sh'));
                        if (hasExe || hasMedia) {
                            results.push({ path: p, source: 'Linux 默认路径' });
                        }
                    }
                }
            }

            // Scan Steam library folders
            for (const steamPath of steamPaths) {
                if (checked.has(steamPath)) continue;
                checked.add(steamPath);

                const libraryVdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
                const libraryPaths = [path.join(steamPath, 'steamapps', 'common', 'ProjectZomboid')];

                if (fs.existsSync(libraryVdf)) {
                    try {
                        const content = fs.readFileSync(libraryVdf, 'utf-8');
                        const pathMatches = content.match(/"path"\s+"([^"]+)"/g);
                        if (pathMatches) {
                            for (const pm of pathMatches) {
                                const libPath = pm.match(/"path"\s+"([^"]+)"/)[1];
                                if (libPath) {
                                    libraryPaths.push(path.join(libPath, 'steamapps', 'common', 'ProjectZomboid'));
                                }
                            }
                        }
                    } catch (e) { }
                }

                for (const pzPath of libraryPaths) {
                    if (results.find(r => r.path === pzPath)) continue;
                    if (fs.existsSync(pzPath)) {
                        const hasExe = fs.existsSync(path.join(pzPath, 'ProjectZomboidServer.exe')) ||
                                       fs.existsSync(path.join(pzPath, 'ProjectZomboid64.exe')) ||
                                       fs.existsSync(path.join(pzPath, 'ProjectZomboidServer')) ||
                                       fs.existsSync(path.join(pzPath, 'ProjectZomboid64')) ||
                                       fs.existsSync(path.join(pzPath, 'start-server.bat')) ||
                                       fs.existsSync(path.join(pzPath, 'start-server.sh'));
                        const hasMedia = fs.existsSync(path.join(pzPath, 'media'));
                        if (hasExe || hasMedia) {
                            results.push({ path: pzPath, source: 'Steam 库: ' + steamPath });
                        }
                    }
                }
            }

            // Also check the current config path
            const currentPath = require('../config.json').pzServer.installPath;
            if (currentPath && !results.find(r => r.path === currentPath)) {
                if (fs.existsSync(currentPath)) {
                    results.push({
                        path: currentPath,
                        source: '当前配置路径'
                    });
                }
            }

            res.json({
                result: 1,
                data: {
                    found: results.length > 0,
                    paths: results
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Get visual config data (parsed INI with metadata)
    router.get('/api/config/visual', checkSession, (req, res) => {
        try {
            const { filename } = req.query;
            if (!filename) return res.json({ result: 0, message: '缺少文件名参数' });

            const raw = serverManager.readConfigFile(filename);
            const lines = raw.split('\n');
            const sections = {};
            let currentSection = 'General';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    currentSection = trimmed.slice(1, -1);
                    continue;
                }
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx === -1) continue;
                const key = trimmed.slice(0, eqIdx).trim();
                const value = trimmed.slice(eqIdx + 1).trim();
                if (!sections[currentSection]) sections[currentSection] = {};
                sections[currentSection][key] = value;
            }

            // Group settings by category with metadata
            const categorized = {};
            const knownKeys = new Set(Object.keys(PZ_SETTINGS));

            for (const [section, fields] of Object.entries(sections)) {
                for (const [key, value] of Object.entries(fields)) {
                    const meta = PZ_SETTINGS[key];
                    const cat = meta ? meta.category : section;
                    if (!categorized[cat]) categorized[cat] = [];
                    categorized[cat].push({
                        key,
                        value,
                        section,
                        meta: meta || { type: 'text', label: key, desc: '' }
                    });
                }
            }

            // Also include known settings that are not in the file (as defaults)
            for (const [key, meta] of Object.entries(PZ_SETTINGS)) {
                let found = false;
                for (const fields of Object.values(sections)) {
                    if (key in fields) { found = true; break; }
                }
                if (!found) {
                    const cat = meta.category;
                    if (!categorized[cat]) categorized[cat] = [];
                    // Only add if not already present
                    if (!categorized[cat].find(s => s.key === key)) {
                        categorized[cat].push({
                            key,
                            value: '',
                            section: 'General',
                            meta,
                            notInFile: true
                        });
                    }
                }
            }

            res.json({
                result: 1,
                data: {
                    filename,
                    categories: categorized,
                    raw: raw
                }
            });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // Save visual config
    router.post('/api/config/visual/save', checkSession, (req, res) => {
        try {
            const { filename, settings } = req.body;
            if (!filename || !settings) return res.json({ result: 0, message: '缺少参数' });

            // Read existing config to preserve comments and structure
            const raw = serverManager.readConfigFile(filename);
            const lines = raw.split('\n');
            const updatedLines = [];
            const changedKeys = new Map();
            for (const s of settings) {
                changedKeys.set(s.key, s.value);
            }

            let currentSection = '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    currentSection = trimmed.slice(1, -1);
                    updatedLines.push(line);
                } else if (trimmed.includes('=')) {
                    const eqIdx = trimmed.indexOf('=');
                    const key = trimmed.slice(0, eqIdx).trim();
                    if (changedKeys.has(key)) {
                        const newVal = changedKeys.get(key);
                        updatedLines.push(`${key}=${newVal}`);
                        changedKeys.delete(key);
                    } else {
                        updatedLines.push(line);
                    }
                } else {
                    updatedLines.push(line);
                }
            }

            // Add remaining new keys
            for (const [key, value] of changedKeys) {
                if (value !== '') {
                    const meta = PZ_SETTINGS[key];
                    const section = meta ? meta.category : 'General';
                    updatedLines.push(`\n[${section}]\n${key}=${value}`);
                }
            }

            const result = serverManager.writeConfigFile(filename, updatedLines.join('\n'));
            res.json({ result: 1, data: result, message: '配置已保存' });
        } catch (err) {
            res.json({ result: 0, message: err.message });
        }
    });

    // ============================================
    // 安装 PZ 专用服务器 (via SteamCMD)
    // ============================================
    let installLogPath = null;
    let installRunning = false;

    router.get('/api/config/install-status', checkSession, (req, res) => {
        if (!installLogPath) return res.json({ result: 1, data: { logs: [], running: false, done: true } });
        try {
            const fs = require('fs');
            const logs = fs.existsSync(installLogPath) ? fs.readFileSync(installLogPath, 'utf-8').split('\n').filter(Boolean).slice(-50) : [];
            res.json({ result: 1, data: { logs, running: installRunning, done: !installRunning } });
        } catch (e) {
            res.json({ result: 1, data: { logs: [], running: installRunning, done: !installRunning } });
        }
    });

    router.post('/api/config/install-pz', checkSession, async (req, res) => {
        const { installPath } = req.body;
        if (!installPath) return res.json({ result: 0, message: '请提供安装路径' });
        if (installRunning) return res.json({ result: 0, message: '安装已在运行中' });

        const fs = require('fs');
        const path = require('path');
        const { spawn } = require('child_process');

        installRunning = true;
        installLogPath = path.join(installPath, 'install.log');
        if (!fs.existsSync(installPath)) fs.mkdirSync(installPath, { recursive: true });

        // Start installation in background, log to file
        setImmediate(async () => {
            const logStream = fs.createWriteStream(installLogPath, { flags: 'a' });
            const log = (msg) => { logStream.write(msg + '\n'); console.log('[install]', msg); };
            const stripAnsi = (text) => String(text || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\r/g, '').trim();

            function download(url, dest, redirects) {
                return new Promise((resolve, reject) => {
                    if (redirects > 5) return reject(new Error('重定向次数过多'));
                    const https = require('https');
                    const req = https.get(url, (res) => {
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            res.resume();
                            return download(res.headers.location, dest, (redirects || 0) + 1).then(resolve, reject);
                        }
                        if (res.statusCode !== 200) {
                            res.resume();
                            return reject(new Error(`HTTP ${res.statusCode}`));
                        }
                        const file = fs.createWriteStream(dest);
                        res.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                        file.on('error', reject);
                    });
                    req.setTimeout(60000, () => req.destroy(new Error('下载超时')));
                    req.on('error', reject);
                });
            }

            try {
                log('[INFO] 正在准备 SteamCMD...');
                const isWindows = process.platform === 'win32';
                const steamcmdDir = path.join(installPath, 'steamcmd');
                const steamcmdExe = path.join(steamcmdDir, isWindows ? 'steamcmd.exe' : 'steamcmd.sh');

                // Download SteamCMD if not present (try multiple mirrors)
                if (!fs.existsSync(steamcmdExe)) {
                    if (!fs.existsSync(steamcmdDir)) fs.mkdirSync(steamcmdDir, { recursive: true });
                    log('[INFO] 正在下载 SteamCMD...');
                    const archivePath = path.join(steamcmdDir, isWindows ? 'steamcmd.zip' : 'steamcmd_linux.tar.gz');
                    const urls = isWindows
                        ? ['https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip',
                           'https://media.steampowered.com/client/installer/steamcmd.zip',
                           'https://cdn.akamai.steamstatic.com/client/installer/steamcmd.zip']
                        : ['https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz',
                           'https://media.steampowered.com/client/installer/steamcmd_linux.tar.gz',
                           'https://cdn.akamai.steamstatic.com/client/installer/steamcmd_linux.tar.gz'];

                    let lastErr = null;
                    for (const u of urls) {
                        try {
                            await download(u, archivePath);
                            lastErr = null;
                            break;
                        } catch (e) {
                            lastErr = e;
                            log(`[WARN] 从 ${u} 下载失败: ${e.message}`);
                        }
                    }
                    if (lastErr) throw new Error('SteamCMD 下载失败: ' + lastErr.message);
                    log('[INFO] SteamCMD 下载完成，正在解压...');

                    try {
                        if (isWindows) {
                            require('child_process').execSync(
                                `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${steamcmdDir.replace(/'/g, "''")}' -Force"`,
                                { timeout: 120000 }
                            );
                        } else {
                            require('child_process').execSync(`tar -xzf "${archivePath}" -C "${steamcmdDir}"`, { timeout: 120000 });
                            require('child_process').execSync(`chmod +x "${steamcmdExe}"`, { timeout: 5000 });
                        }
                    } finally {
                        try { fs.unlinkSync(archivePath); } catch (e) {}
                    }

                    if (!fs.existsSync(steamcmdExe)) {
                        throw new Error('SteamCMD 解压失败，未找到可执行文件');
                    }
                    log('[INFO] SteamCMD 准备就绪');
                }

                // Install PZ server via SteamCMD
                const pzInstallPath = path.join(installPath, 'ProjectZomboid');
                if (!fs.existsSync(pzInstallPath)) fs.mkdirSync(pzInstallPath, { recursive: true });
                log('[INFO] 正在连接 Steam 服务器...');
                log('[INFO] 正在下载 Project Zomboid 服务器 (AppID: 380870)...');

                const args = [
                    '+force_install_dir', pzInstallPath,
                    '+login', 'anonymous',
                    '+app_update', '380870',
                    'validate',
                    '+quit'
                ];
                if (isWindows) args.unshift('+@sSteamCmdForcePlatformType', 'windows');

                const child = spawn(steamcmdExe, args, { cwd: steamcmdDir });
                let installOutput = '';
                child.stdout.on('data', (buf) => {
                    const text = stripAnsi(buf.toString());
                    if (text) { installOutput += text + '\n'; log(text); }
                });
                child.stderr.on('data', (buf) => {
                    const text = stripAnsi(buf.toString());
                    if (text) { installOutput += text + '\n'; log(text); }
                });

                const exitCode = await new Promise((resolve, reject) => {
                    child.on('close', resolve);
                    child.on('error', reject);
                });

                if (exitCode !== 0) {
                    throw new Error(`SteamCMD 退出码: ${exitCode}`);
                }
                if (/failed to install app/i.test(installOutput) || /no subscription/i.test(installOutput)) {
                    throw new Error('Steam 拒绝了安装请求（可能需要在 SteamCMD 中登录或该 AppID 不可匿名下载）');
                }

                const serverExe = isWindows
                    ? ['ProjectZomboidServer.exe', 'ProjectZomboid64.exe']
                    : ['ProjectZomboidServer', 'ProjectZomboid64'];
                if (!serverExe.some(n => fs.existsSync(path.join(pzInstallPath, n)))) {
                    throw new Error('安装目录中未找到服务器程序，安装可能未成功');
                }

                log('[INFO] 正在更新配置...');
                const configPath = path.join(__dirname, '..', 'config.json');
                let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                config.pzServer.installPath = pzInstallPath;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                log('[SUCCESS] 安装完成！');
            } catch (err) {
                log('[ERROR] 安装失败: ' + err.message);
            } finally {
                installRunning = false;
                logStream.end();
            }
        });

        res.json({ result: 1, message: '安装已开始，请查看实时日志', logPath: installLogPath });
    });

    return router;
};