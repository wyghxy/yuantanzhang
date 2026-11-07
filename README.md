# 元探长个人版

一个用于收集内容、研究对标、整理选题与创作稿件的个人工作台。

元探长个人版开放 **情报中心、创作中心、对标中心、采集库** 四个板块及其全部子页面的前端、后端和相关业务源码，保留完整界面与功能入口，项目自有代码采用 [MIT 许可证](LICENSE)。

除商业运营所需的平台账号管理体系、付费接口及其接入实现外，四个板块个人版所需的其他代码全部开源。原平台部分在线处理能力使用付费接口；个人使用者可根据自身需要，自行修改代码，接入自动抓取或其他处理方案。个人版不附带这些外部处理服务，相关页面与操作入口仍然保留。

![创作中心：选题与情报流](docs/screenshots/creation.png)

## 四个板块

| 板块 | 内容 |
| --- | --- |
| 情报中心 | 素材概览、来源分布、内容筛选、阅读状态与创作方向。 |
| 创作中心 | 选题与情报流、稿件编辑、原稿引用、内容拆解、参考播放器与版本保存。 |
| 对标中心 | 博主资料、平台身份、备注、关联作品与筛选。 |
| 采集库 | 原文与文件导入、内容检索、来源与作者关联、笔记、阅读与恢复。 |

首次使用包含少量明确标记为“演示”的虚构案例。素材、选题、拆解和稿件可以直接打开与编辑；它们不是实际平台采集结果。可以保留这些案例，也可以单独清除演示数据。

## 本地运行

需要 Node.js 22、pnpm 9.15.9、PostgreSQL 16 和 Redis。开发与构建采用同一个 pnpm workspace。

```bash
cp .env.example .env
# 编辑 .env：设置自己的登录密码与至少 32 字符的随机 SESSION_SECRET。
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm run setup
pnpm dev
```

浏览器打开 <http://127.0.0.1:3310>。登录用户名使用 `.env` 中的 `PERSONAL_USERNAME`，密码使用自己设置的 `PERSONAL_PASSWORD`。没有预设登录密码。

数据库、Redis、API 和网站默认使用本机连接。数据库连接与存储位置可以在自己的环境文件中调整。先备份已有数据，再进行升级或变更存储目录。

详细说明见 [安装与运行](docs/installation.md) 和 [日常使用](docs/usage.md)。

## 开发与验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:browser
pnpm build
pnpm check:release
```

集成与浏览器验证使用独立测试数据库，设置方式见 [验证与发布](docs/quality.md)。验证输出只代表相应命令、环境和覆盖范围。

## 文档

- [设计系统](docs/design-system.md)：主题、字体、布局、组件、响应式与状态。
- [页面与功能地图](docs/page-map.md)：四板块、子页面和操作入口。
- [界面截图](docs/screenshots/creation.png)：[拆解](docs/screenshots/breakdown.png)、[深色稿件](docs/screenshots/writing-dark.png)、[手机](docs/screenshots/mobile.png)。
- [架构](docs/architecture.md)：Web、API、数据、Worker 与本地文件职责。
- [前端接口清单](docs/frontend-api.md)：界面使用的业务请求。
- [扩展边界](docs/extending.md)：自行改造与外部处理的接入原则。
- [贡献说明](CONTRIBUTING.md)、[安全说明](SECURITY.md)、[行为准则](CODE_OF_CONDUCT.md)。

## 许可

允许个人使用、修改、分发和商用。分发代码或其重要部分时，须保留 `Copyright (c) 2026 元探长` 版权声明与完整 MIT 许可文本；不要求在产品首页强制署名。

依赖库、字体等第三方材料保留各自的许可证与版权声明，见 [第三方声明](THIRD_PARTY_NOTICES.md)。
