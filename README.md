# Yanten API 🚀

> 统一后端服务 - 支持家庭备忘录、哇哇笑等多个微信小程序项目

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.18-blue.svg)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Online-success.svg)](https://yanten.top/api/health)

---

## 📱 服务项目

| 项目 | 类型 | API路径 | 状态 |
|------|------|---------|------|
| **家庭备忘录** | 微信小程序 | `/api/family/*` | ✅ 运行中 |
| **哇哇笑** | 微信小程序 | `/api/wawaxiao/*` | ✅ 运行中 |
| 更多项目... | - | - | 🔜 规划中 |

---

## ✨ 核心功能

### 🏠 家庭备忘录

- **购物清单** - 家庭购物协作管理
- **待办事项** - 任务分配与追踪
- **日程安排** - 家庭活动日程表
- **消息通知** - 实时家庭消息推送
- **反馈系统** - 用户意见收集

### 😄 哇哇笑

- **笑话库** - 102+条精选笑话
- **点赞系统** - 用户喜好记录
- **分享统计** - 分享数据追踪
- **分类浏览** - 多维度分类
- **热门推荐** - 热门笑话推荐

---

## 🔒 安全特性

- ✅ **API限流** - 防恶意请求攻击
- ✅ **JWT认证** - 安全用户认证
- ✅ **CORS限制** - 白名单域名访问
- ✅ **安全Headers** - HSTS、防嗅探
- ✅ **请求日志** - 错误与慢请求监控

---

## 📊 数据安全

- ✅ **SQLite数据库** - 轻量高性能
- ✅ **OSS云备份** - 每小时自动备份（阿里云）
- ✅ **数据持久化** - 定期自动保存
- ✅ **日志清理** - 定时清理过期日志

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PM2 (生产环境)
- 阿里云账号（可选，用于OSS备份）

### 安装

```bash
# 克隆项目
git clone https://github.com/foleydang/yanten-api.git
cd yanten-api

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入真实配置

# 初始化数据库
npm run init-db

# 启动开发服务器
npm run dev

# 或启动生产服务器
pm2 start ecosystem.config.js --env production
```

### 配置说明

编辑 `.env` 文件：

```bash
# 微信小程序配置（必须）
WECHAT_APP_ID_FAMILY=你的家庭备忘录AppID
WECHAT_APP_SECRET_FAMILY=你的家庭备忘录AppSecret
WECHAT_APP_ID_WAWAXIAO=你的哇哇笑AppID
WECHAT_APP_SECRET_WAWAXIAO=你的哇哇笑AppSecret

# JWT密钥（必须）
JWT_SECRET=你的随机密钥

# OSS备份（可选）
OSS_ACCESS_KEY_ID=你的OSS密钥ID
OSS_ACCESS_KEY_SECRET=你的OSS密钥Secret
```

---

## 📖 API文档

### 基础地址

```
https://yanten.top/api
```

### 主要接口

#### 健康检查
```bash
GET /api/health
```

#### 哇哇笑接口
```bash
GET  /api/wawaxiao/jokes      # 获取笑话列表
GET  /api/wawaxiao/random     # 随机笑话
POST /api/wawaxiao/like/:id   # 点赞
GET  /api/wawaxiao/stats      # 统计数据
```

#### 家庭备忘录接口（需认证）
```bash
POST /api/auth/login          # 微信登录
GET  /api/family/info         # 家庭信息
GET  /api/shopping/list       # 购物清单
POST /api/todo/add            # 添加待办
GET  /api/schedule/list       # 日程列表
```

完整API文档请查看 `docs/` 目录。

---

## 📁 项目结构

```
yanten-api/
├── src/                  # 源代码
│   ├── index.js          # Express主文件
│   ├── routes/           # API路由（8个）
│   ├── middleware/       # 中间件（认证、限流等）
│   ├── utils/            # 工具函数（数据库等）
│   └── scripts/          # 脚本（初始化、备份等）
├── data/                 # 数据存储
│   └── database/         # SQLite数据库
├── docs/                 # 项目文档 ⭐
│   ├── MIGRATION-GUIDE.md
│   ├── OSS-BACKUP-GUIDE.md
│   ├── OPTIMIZATION-REPORT.md
│   └── 更多文档...
├── config/               # 配置文件
├── .env                  # 环境变量（不提交）
├── .env.example          # 环境变量示例
├── ecosystem.config.js   # PM2配置
└── README.md             # 项目说明（本文件）
```

---

## 🛠️ 常用命令

### 开发

```bash
npm run dev          # 开发模式
npm run init-db      # 初始化数据库
npm run test-oss     # 测试OSS连接
npm run backup       # 手动备份
```

### 生产

```bash
pm2 list             # 查看服务状态
pm2 logs yanten-api  # 查看日志
pm2 restart yanten-api  # 重启服务
pm2 monit            # 监控面板
```

---

## 📚 文档目录

| 文档 | 说明 |
|------|------|
| [迁移指南](docs/MIGRATION-GUIDE.md) | 从旧项目迁移的完整步骤 |
| [OSS备份指南](docs/OSS-BACKUP-GUIDE.md) | 阿里云OSS配置和使用 |
| [优化报告](docs/OPTIMIZATION-REPORT.md) | 详细优化清单和效果 |
| [部署总结](docs/DEPLOYMENT-SUMMARY.md) | 部署步骤和验证方法 |
| [完整总结](docs/FINAL-SUMMARY.md) | 项目成果汇总 |
| [修复总结](docs/FINAL-FIX-SUMMARY.md) | 问题修复记录 |
| [项目完成](docs/PROJECT-COMPLETE.md) | 项目最终状态 |

---

## 📊 服务状态

实时监控：https://yanten.top/api/health

当前状态：
- ✅ 服务正常运行
- ✅ production环境
- ✅ API限流已启用
- ✅ OSS自动备份
- ✅ 102条笑话数据

---

## 🔧 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | 18+ | 运行环境 |
| Express | 4.18 | Web框架 |
| SQLite | sql.js | 数据库 |
| JWT | jsonwebtoken | 认证 |
| PM2 | 最新 | 进程管理 |
| Ali-OSS | 6+ | 云备份 |
| Helmet | 安全中间件 | 安全防护 |
| Express-Rate-Limit | 6+ | API限流 |

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📝 更新日志

### v1.0.0 (2026-05-07)

- ✅ 完整项目迁移（从family-memo分离）
- ✅ 8个API路由正常运行
- ✅ 安全防护全面启用
- ✅ OSS自动备份配置
- ✅ 完整文档体系建立
- ✅ GitHub仓库推送成功
- ✅ 102条笑话数据导入
- ✅ 哇哇笑微信密钥配置

---

## 📄 License

MIT License - 自由使用、修改、分发

---

## 👨‍💻 作者

- **GitHub:** [@foleydang](https://github.com/foleydang)
- **项目地址:** https://github.com/foleydang/yanten-api

---

## 🌟 Star History

如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！

---

## 📞 问题反馈

- **GitHub Issues:** https://github.com/foleydang/yanten-api/issues
- **API健康检查:** https://yanten.top/api/health

---

**Made with ❤️ by foleydang**