# 个人工作台前端接口
页面为 `/workspace/viral?view=overview|topics|accounts|works`；素材和写稿均为同一个工作台的子页。浏览器走同源 `/api`，Next 转给本机 Nest。会话由服务端 cookie 维持。

| 功能 | 接口与返回 |
|---|---|
| 本机直接进入 | 默认 `PERSONAL_AUTH_MODE=local`；浏览器自动 POST /api/auth/local，校验本机连接、Host、Origin 后设置 HttpOnly 会话并返回 user/workspace。用户无需注册、输入用户名或密码；业务接口仍要求该会话。 |
| 可选密码保护 | 显式 `PERSONAL_AUTH_MODE=password` 后使用 POST /api/auth/login：username/password；本机自动入口禁用。GET /api/auth/me：user 与 workspace；POST /api/auth/logout。两种模式的会话不能相互绕过。 |
| 来源链接识别 | POST /api/workspace/studio/links，请求 `{text}`；返回 `link`，含 url/platform/detectedKind/nativeId/requiresResolution。只在本地按 URL 分类，不联网读取页面或解析短链；短链可标记为待还原。 |
| 本机采集配置 | GET/PATCH /api/workspace/studio/local-collector，返回 `{configured,endpoint,version}`；PATCH 使用 `{endpoint,expectedVersion}` 做版本校验，空 endpoint 断开。只接受 API 运行电脑的本机 HTTP 地址。 |
| 本机采集执行 | POST /api/workspace/studio/local-collector/run，请求 `{url,accountId?}`；调用使用者已配置的本机程序，最多20条/2MiB；真实素材入库，返回 `{items,importedCount,duplicateCount}`。已有来源不覆盖，包括回收站中的已有记录。详细合同见 [本机采集接入](local-collector.md)。 |
| 雷达 | GET dashboard（counts/platforms/ranges/tasks/compute/recentTopics/recent）；preferences GET、PATCH（expectedVersion）；recommendations 按 category/offset/limit 返回 items/total/hasMore |
| 账号、素材、选题、草稿、灵感 | /api/workspace/studio/{accounts,materials,topics,drafts,identities,ideas,works,candidates,reports}；GET 列表 items/total，GET 详情 item；POST/PATCH 返回 item；DELETE、restore 校验 expectedVersion；草稿还使用 draft 别名、冲突返回 current |
| 跨模块绑定 | 素材保存 accountId，选题保存 references/materialId、草稿保存 topicId/materialId；关联详情、adoptions、ideas/:id/convert、历史版本读取与恢复走本地服务 |
| 编辑器 | drafts/:id、/candidates、/history、/restore、/finalize 和导出；materials/:id、/article、/player、/prepare、/comments；素材摘要和已保存的播放内容必须可读，不需要执行外部处理 |
| 采集库与本地上传 | materials 支持 ids、sample、platform、accountId、readState、q、deleted、collectionView；POST uploads 接原始字节、X-Studio-Filename；媒体按 workspace 授权下载并支持 Range；uploads 返回 material、assetKey |
| 状态与任务 | GET tasks 列表/详情/日志；平台与转写状态集中在调度页。本机采集仅显式执行 run，自动调度由使用者自己的程序决定；其他未接入的外部处理入口仍明确提示未接入 |
| 示例清除 | DELETE /api/workspace/studio/demo；仅清除示例记录 |
| 内容项目 | GET/POST /api/workspace/content-projects；/content-projects/:id、/:id/master-script、/:id/writing；/content-opportunities；本地创建、编辑、归档、素材和母稿引用；草稿可从自身的 handoff-preview/handoff 交接到项目 |
| 名单导入 | GET/POST /api/workspace/studio/roster-imports/sources；POST roster-imports/preview；GET roster-imports/:id；POST roster-imports/:id/confirm，仅把勾选行保存为对标账号 |
| 分镜与参考图片 | 已保存计划属于素材或草稿；本地 source-images 接文件上传、粘贴及移除/恢复；网络搜图和远程处理需要外部能力 |
| 导出与播放 | 文稿下载 TXT/Markdown；浏览器绘制 PNG/ZIP；作品播放器读取当前账号可访问的本地 mediaUrl，支持播放、定位与下载 |
