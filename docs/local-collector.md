# 本机采集程序接入

元探长可以连接使用者自己运行的本机 HTTP 程序。它提供通用连接和入库能力，不内置网站抓取器，也不附带外部采集服务。

在“采集调度”的“采集设置”中填写自己的本机程序地址，保存后输入来源链接并点击“开始采集”。保存地址不会发送采集请求，也不表示程序已经连通。尚未配置时不会向外部发送采集请求。

这里的“本机”指 API 运行的电脑。浏览器远程访问某个实例时，配置地址仍指向该实例的 API 电脑，不指向浏览器所在设备。

## 本机程序合同

程序地址只允许 `http://127.0.0.1`、`http://localhost` 或 `http://[::1]`，可包含端口和路径，不接受用户名、密码、查询串或片段。程序由使用者自行实现和启动。

一次明确的采集操作向配置的地址提交 JSON：

```json
{
  "version": 1,
  "url": "https://example.com/article"
}
```

关联对标账号时，请求还可包含 `account: {id, name}` 和 `platform`，便于自己的程序处理上下文；不发送本实例登录会话。

程序应返回 JSON 对象，最多 20 条记录、响应体不超过 2 MiB：

```json
{
  "items": [
    {
      "url": "https://example.com/article",
      "title": "一条已取得正文的素材",
      "text": "程序实际取得的正文内容。",
      "author": "作者名称",
      "platform": "local"
    }
  ]
}
```

`url`、`title`、`text` 为素材内容，`author` 与 `platform` 为可选信息。只返回实际取得的内容，不将示例或模型猜测当作已抓取正文。

## 元探长业务接口

以下接口使用当前个人会话，调用方不能通过请求体指定其他工作空间：

| 操作 | 请求与响应 |
| --- | --- |
| 读取配置 | `GET /api/workspace/studio/local-collector` → `{configured, endpoint, version}`。 |
| 保存地址 | `PATCH /api/workspace/studio/local-collector`，请求 `{endpoint, expectedVersion}`，成功返回当前配置。 |
| 断开 | 同一 PATCH，将 `endpoint` 设为空字符串，并提供当前 `expectedVersion`。 |
| 开始采集 | `POST /api/workspace/studio/local-collector/run`，请求 `{url, accountId?}`；`accountId` 可将结果关联到当前工作空间内的对标账号。 |

采集完成返回 `{items, importedCount, duplicateCount}`。只有真实返回并通过校验的内容才会入库；同一来源 URL 已存在时跳过，不覆盖已有个人内容。已有素材位于回收站时仍保留删除状态，不自动恢复；结果中的 `deletedAt` 表示该状态。

配置更新使用版本校验。收到 `409 version_conflict` 时重新读取配置，再由使用者确认修改；没有配置、超时或程序返回无效内容时明确反馈错误，不伪造成功结果。

一次请求最长等待 12 秒。超过响应大小或条数限制、无效 JSON 和不符合合同的条目不会入库；并发返回同一来源只新增一条。调用期间断开或更改程序地址后，不导入旧地址返回的结果。

该接口只在使用者主动触发时调用程序。自行运行的定时任务属于使用者自己的实现，不表示元探长已内置自动抓取或定时采集器。需要现成线上服务时，可直接打开[官方在线版](https://yuantanzhang.cn/workspace/viral)；线上账号、服务和本机资料分别管理。
