# 第三方声明

项目自有代码、文档和 `apps/web/public/demo/` 中的原创演示插画按根目录 [MIT 许可证](LICENSE) 提供。

第三方依赖、字体、图标和其他材料仍受各自许可证约束。根 MIT 许可证不替代这些许可证，也不授予第三方品牌或商标的额外权利。

## 字体

- **Inter**：SIL Open Font License 1.1。
- **Noto Sans SC**（项目 CSS 名称可为 `Radar Sans SC`）：SIL Open Font License 1.1。

完整许可证与版权声明分别保存在：

- [`apps/web/public/fonts/radar/Inter-OFL.txt`](apps/web/public/fonts/radar/Inter-OFL.txt)。
- [`apps/web/public/fonts/radar/NotoSansSC-OFL.txt`](apps/web/public/fonts/radar/NotoSansSC-OFL.txt)。

该目录包含 Inter 可变字体、Noto Sans SC 完整字体及供界面加载的中文子集。完整字体的转换来源与文件校验值见相邻 `NotoSansSC-Full.provenance.json`。字体许可证中的保留字体名称等条件继续适用；修改或重新分发字体时应阅读原文。

## 界面依赖

Next.js、React、Tailwind CSS、Radix UI、TanStack Query、Tiptap 等依赖各自保留其上游声明；Lucide 图标保留其 ISC 许可条件。实际安装版本由 `pnpm-lock.yaml` 固定。

Tiptap 及相关 ProseMirror 组件由各自权利人提供。使用开源编辑组件的权限不自动包含上游付费扩展或云服务。

## 服务端依赖

NestJS、Prisma、SQLite 及其他运行依赖遵循各自许可证或适用的分发条款。它们不能因为项目自有代码采用 MIT 就被重新标记为 MIT。实际依赖与版本以本版本锁文件为准，旧版本依赖声明保留在对应标签中。

## 分发检查

安装的包通常在其包目录包含 LICENSE、NOTICE 或版权声明。生成包含这些依赖的分发物时，应保留适用的声明，并按实际打包内容补齐许可副本。新增复制到仓库的第三方源文件、图片或字体时，应在本文件登记来源、版本、路径和适用条款。

不明来源或没有明确再分发授权的材料不应加入公开发布包。

## 原创演示与平台标签

个人版采用自行绘制的字母和几何图形区分平台，文件位于 `apps/web/public/radar-ui/platform-*.svg`；这些图形不使用平台的官方标志或外部资源。它们与 `apps/web/public/demo/` 中的三份案例插画和品牌标记同属本项目原创材料，按根 MIT 许可证提供。
