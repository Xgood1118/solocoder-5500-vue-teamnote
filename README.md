# 📝 TeamNote - 团队内部协作文档工具

> 比 Notion 轻量的团队协作文档工具。基于 Vue 3 + Node.js + Yjs CRDT 实现。

## ✨ 核心功能

### 三层结构与版本
- **工作空间 / 文件夹 / 笔记** 三层层级组织
- 笔记支持多版本快照，**一键回滚**任意历史版本
- 编辑历史**逐条回放**，追踪变更过程

### 实时协作 (CRDT)
- **Yjs CRDT** 无冲突同步，编辑永不冲突
- 多光标 / 选区实时同步，看见同事正在哪里编辑
- 离线编辑后重新联网自动合并
- 编辑历史快照记录所有操作

### 块级评论与通知
- 每个内容块独立评论
- **@同事 / @所有人 / @管理员 / @编辑者** 等提及
- 已解决的评论自动折叠
- 通知中心 SSE 实时推送提醒

### 5 级权限系统
| 角色 | 权限 |
|---|---|
| 👑 Owner 所有者 | 所有权限 + 所有权转让 |
| 🛡️ Admin 管理员 | 成员管理 / 工作空间设置 / 审计日志 |
| ✏️ Editor 编辑者 | 创建/编辑笔记 / 评论 / 标签管理 |
| 👁️ Viewer 浏览者 | 查看 / 评论 / 导出 |
| 👤 Guest 访客 | 仅查看 |
- 文件夹和笔记可独立设权、**访客邀请链接**
- 完整**审计日志**追踪所有操作

### 全文搜索
- **BM25 算法** + **nodejieba 中文分词**
- 标题 / 标签 / 内容 搜索结果高亮
- 搜索历史记录 + 热门词聚合
- 独立**标签库**管理

### 模板与导入导出
- 内置周报 / 月报 / 会议纪要 / PRD / 技术方案等模板
- 自定义模板创建
- 导出：**Markdown / HTML / PDF**
- 导入：**Markdown / Docx (Word)**

### 可靠性
- JSON 文件存储，数据清晰可读
- **Cron 定期自动备份**，保留最近 N 份
- 端口 / 路径 等全部走环境变量

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 启动后端

```bash
cd backend
cp .env.example .env   # 可自定义端口等
npm start
```

默认端口：
- HTTP API：**3001**
- WebSocket：复用 HTTP 端口，路径 `/ws/collab`

### 3. 启动前端

```bash
cd frontend
npm run dev
```

打开 http://localhost:5173 即可访问。

### 4. 默认账号

首次启动自动创建种子数据，所有账号密码均为 `123456`：

| 用户名 | 角色 |
|---|---|
| `owner` | 工作空间所有者 |
| `admin` | 管理员 |
| `editor` | 编辑者 |
| `viewer` | 浏览者 |
| `guest` | 访客 |

---

## 📁 项目结构

```
5500-vue-teamnote/
├── backend/                      # Node.js + Express 后端
│   ├── src/
│   │   ├── config/               # 环境配置
│   │   ├── storage/              # JSON 存储 + 备份 + 种子数据
│   │   ├── middleware/           # 认证、权限中间件
│   │   ├── services/             # 业务服务
│   │   │   ├── collaboration.js  # Yjs CRDT WebSocket 服务器
│   │   │   ├── search.js         # BM25 + nodejieba 搜索引擎
│   │   │   ├── notification.js   # 通知 + @提及解析
│   │   │   └── audit.js          # 审计日志
│   │   ├── controllers/          # 各业务控制器
│   │   ├── routes/               # Express 路由
│   │   ├── utils/                # 通用工具
│   │   ├── server.js             # Express 服务器装配
│   │   └── index.js              # 入口
│   ├── package.json
│   └── .env.example
└── frontend/                     # Vue 3 + Vite 前端
    ├── src/
    │   ├── views/                # 页面视图
    │   │   ├── Login.vue          # 登录/注册
    │   │   ├── Invite.vue         # 邀请链接加入
    │   │   ├── Layout.vue         # 主布局（侧边栏/顶栏）
    │   │   ├── Workspace.vue      # 工作空间 + 文件夹 + 笔记列表
    │   │   ├── NoteEditor.vue     # 笔记编辑器（实时协作核心）
    │   │   ├── WorkspaceSettings.vue  # 成员/邀请/审计设置
    │   │   ├── SearchCenter.vue   # 全文搜索中心
    │   │   ├── TemplateLibrary.vue # 模板库
    │   │   ├── Notifications.vue  # 通知中心
    │   │   └── Profile.vue        # 个人设置
    │   ├── stores/               # Pinia 状态管理
    │   │   ├── user.js            # 用户与会话
    │   │   └── collab.js          # Yjs 客户端 + 协作状态
    │   ├── api/                  # axios 封装 + API 定义
    │   ├── router/               # Vue Router
    │   ├── assets/styles/        # 全局样式
    │   ├── App.vue
    │   └── main.js
    ├── vite.config.js
    └── package.json
```

---

## 🔌 主要 API 接口

| 分类 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 认证 | POST | `/api/auth/login` | 登录 |
| | POST | `/api/auth/register` | 注册 |
| | POST | `/api/auth/login-invite` | 邀请链接加入 |
| | GET | `/api/auth/profile` | 获取当前用户 |
| 工作空间 | GET/POST | `/api/workspaces` | 列表 / 创建 |
| | GET/PUT/DELETE | `/api/workspaces/:id` | 获取 / 更新 / 删除 |
| | POST | `/api/workspaces/:id/members` | 成员角色变更 |
| | POST | `/api/workspaces/:id/invites` | 生成邀请链接 |
| | GET | `/api/workspaces/:id/audit-logs` | 审计日志 |
| 文件夹 | GET | `/api/folders/ws/:id` | 工作空间内文件夹 |
| | GET | `/api/folders/ws/:id/tree` | 目录树 |
| | POST/PUT/DELETE | `/api/folders[/:id]` | CRUD |
| 笔记 | GET | `/api/notes/ws/:id[/recent]` | 列表 / 最近 |
| | GET/PUT/DELETE | `/api/notes/:id` | 获取 / 更新 / 删除 |
| | POST | `/api/notes/:id/versions` | 保存快照 |
| | GET | `/api/notes/:id/versions` | 历史版本 |
| | POST | `/api/notes/:id/rollback` | 回滚 |
| 评论 | GET | `/api/comments/note/:id` | 笔记评论列表 |
| | POST/PUT/DELETE | `/api/comments[/:id]` | CRUD |
| | POST | `/api/comments/:id/resolve` | 标记解决/重开 |
| 搜索 | GET | `/api/search?q=` | 全文搜索 |
| | GET | `/api/search/history/:wsId` | 搜索历史 |
| | GET | `/api/search/hot/:wsId` | 热门词 |
| 标签/模板/通知 | GET/POST/DELETE | `/api/tags` / `/api/templates` / `/api/notifications` | 各 CRUD |
| 导入导出 | GET | `/api/io/notes/:id/export/(md\|html\|pdf)` | 三种格式导出 |
| | POST | `/api/io/import/(md\|file)` | Markdown / 文件 导入 |
| 实时协作 | WS | `/ws/collab?noteId=&token=` | Yjs CRDT 同步 |
| SSE 事件 | GET | `/api/events/sse?token=` | 通知实时推送 |

---

## 🔧 环境变量（backend/.env）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 3001 | HTTP 端口 |
| `WS_PORT` | 3002 | （standalone 时）WS 端口，默认复用 HTTP |
| `JWT_SECRET` | dev-secret-... | JWT 密钥，生产请修改 |
| `JWT_EXPIRES_IN` | 7d | Token 有效期 |
| `DATA_DIR` | ./data | JSON 数据目录 |
| `BACKUP_DIR` | ./backups | 备份目录 |
| `BACKUP_INTERVAL_MINUTES` | 60 | 自动备份周期（分钟） |
| `MAX_BACKUPS` | 10 | 保留的最大备份份数 |
| `UPLOAD_DIR` | ./uploads | 上传文件临时目录 |
| `NODE_ENV` | development | 运行环境 |
| `CORS_ORIGIN` | * | CORS 来源 |

---

## 🛡️ 安全与最佳实践

- 生产环境务必修改 `JWT_SECRET` 为强随机值
- 设置 `NODE_ENV=production` 和 `CORS_ORIGIN` 为你的域名
- 建议通过 HTTPS 部署，避免 WebSocket 明文传输
- 定期检查 `backups/` 目录备份是否正常

---

## 📝 License

MIT
