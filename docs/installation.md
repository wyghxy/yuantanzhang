# 安装与运行

## 环境

- Node.js 22，项目要求见根 `package.json` 的 `engines`。
- pnpm 9.15.9。
- PostgreSQL 16、Redis，以及可写的本地上传目录。
- 使用 Docker Compose 时需要可用的 Docker 服务。

Windows 用户可在 WSL 中安装依赖、初始化数据库并启动项目。保持代码、命令运行目录和环境配置一致，不混用 Windows 与 Linux 的 `node_modules`。

## 首次安装

在项目根目录执行：

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm run setup
pnpm dev
```

执行 `setup` 前，编辑自己的 `.env`：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 个人版 PostgreSQL 连接；数据库应单独使用。 |
| `REDIS_URL` | 本地 Redis 连接。 |
| `PERSONAL_USERNAME` | 个人登录用户名。 |
| `PERSONAL_PASSWORD` | 自己设置的强密码，没有预设登录密码。 |
| `SESSION_SECRET` | 至少 32 字符的随机值，用于个人会话。 |
| `UPLOAD_DIR` | 上传文件的存储目录。 |
| `WEB_PORT` / `API_PORT` | 默认分别为 3310 / 3311。 |
| `API_ORIGIN` | Web 服务访问本地 API 的地址。 |

环境文件不应提交到 Git。这里的数据库、密码和会话配置只服务于自己的部署，不涉及外部处理接口配置。

浏览器打开 <http://127.0.0.1:3310>，使用自己的账号登录。`setup` 初始化个人身份和演示内容，案例通过普通页面直接使用。

## 生产构建

```bash
pnpm build
```

运行入口和环境要求以根目录脚本为准。公网部署前应配置 HTTPS、访问控制及反向代理，不把数据库和 Redis 端口直接公开。个人版不包含面向公众的注册运营体系。

## 数据与升级

PostgreSQL 和上传目录共同构成个人业务数据。升级前备份二者，确认对应版本的迁移与兼容说明，再应用迁移。不要对正在使用的数据库执行测试重置。

停止 Web/API/Worker 不会替代数据库备份。重新安装依赖也不应该删除自己的数据库、稿件和媒体。

## 常见问题

| 现象 | 检查内容 |
| --- | --- |
| 初始化失败 | 数据库是否启动、连接是否正确、迁移是否完成。 |
| 登录失败 | 初始化是否成功、用户名和密码是否与自己的环境一致。 |
| 页面无法取得内容 | API 是否启动、`API_ORIGIN` 是否正确、当前会话是否有效。 |
| 文件上传失败 | 文件类型与大小、上传目录写权限、API 请求限制。 |
| 外部处理操作提示未接入 | 这是该能力的当前状态；可继续使用已有内容和本地编辑，或自行实现扩展。 |
| 演示案例未显示 | 检查是否执行 `pnpm demo:seed`，以及界面是否筛选为个人内容。 |

反馈问题时保留错误类型和复现步骤，删除密码、连接信息、Cookie 和私人正文后再分享日志。
