# 元探长

一个用于收集内容、研究对标、整理选题与创作稿件的个人工作台。

| 使用方式 | 从这里开始 |
| --- | --- |
| 官方在线版 | [立即使用官方在线版](https://yuantanzhang.cn/workspace/viral)，无需本地安装，使用网站账号和线上服务。 |
| 本机个人版 | 下载源码后按下方三步启动，默认免登录，稿件与素材保存在自己的电脑。 |

下载包解压后，也可双击 [开始使用.html](开始使用.html)，选择官方在线版或已启动的本机个人版入口。

[元探长官网](https://yuantanzhang.cn/) · [线上产品样例（免登录）](https://yuantanzhang.cn/preview?view=overview) · [进入线上工作台](https://yuantanzhang.cn/workspace/viral)

官网介绍产品，线上样例用于免登录查看界面，线上工作台使用网站账号登录。本仓库是可在自己电脑运行的开源版本，与这三个线上入口分别使用自己的运行环境和数据。

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

需要采集自己的内容时，可以在“采集调度 → 采集设置”连接自己运行的本机 HTTP 程序。只有明确点击“开始采集”才会调用，真实结果入库并按来源去重。本机指 API 运行的电脑；本站不内置平台抓取器，自动调度由自己的采集程序决定。详见[本机采集接入](docs/local-collector.md)。

## 本地运行

从旧浏览器版升级的用户，请先阅读 [升级与数据保留说明](docs/migrating-from-browser-edition.md)。

需要 Node.js 22.23.2 及以上的 22.x 版本和 pnpm 9.15.9。默认使用本地 SQLite 单文件存储，不需要额外安装 PostgreSQL、Redis 或 Docker。

```bash
pnpm install
pnpm run setup
pnpm dev
```

`setup` 自动生成本机 `.env`、SQLite 数据文件与上传目录，完成数据库生成和迁移，并初始化个人工作区与演示案例。默认 `PERSONAL_AUTH_MODE=local`，打开即进入自己的本机工作区，无需注册或输入用户名、密码。后台自动建立本机个人会话，继续校验资料和文件归属。

浏览器打开 <http://127.0.0.1:3310>。正文、稿件、关系和任务默认保存在 `data/yuantanzhang.db`，上传文件保存在 `data/uploads/`。备份时停止应用与 Worker，保留数据库、上传文件及自己的配置；详情见安装说明。

本机模式只面向本机访问，不是匿名公网分享。需要主动启用密码保护时，可将 `.env` 的 `PERSONAL_AUTH_MODE` 改为 `password` 并重启；备用随机密码保存在本机 `.env`，日常本机模式无需查看或输入。详见[可选密码保护](docs/installation.md#可选密码保护)。

已有 SQLite 配置会保留；检测到旧 PostgreSQL 配置时初始化会停止，避免覆盖旧环境。

从 `v0.2.0` PostgreSQL 版本升级时，保留旧库、媒体、配置和旧版源码；目前没有自动迁移到 SQLite 的工具，不能直接用旧数据库目录覆盖新文件。

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
- [本机采集接入](docs/local-collector.md)：自己的本机程序与通用入库接口合同。
- [扩展边界](docs/extending.md)：自行改造与外部处理的接入原则。
- [贡献说明](CONTRIBUTING.md)、[安全说明](SECURITY.md)、[行为准则](CODE_OF_CONDUCT.md)。

## 许可

允许个人使用、修改、分发和商用。分发代码或其重要部分时，须保留 `Copyright (c) 2026 元探长` 版权声明与完整 MIT 许可文本；不要求在产品首页强制署名。

依赖库、字体等第三方材料保留各自的许可证与版权声明，见 [第三方声明](THIRD_PARTY_NOTICES.md)。

本版本自有代码采用 MIT；旧版本按其对应提交中的许可证使用，详见 [许可说明](LICENSING.md)。
