# Deploy the Vite SPA With Workers Static Assets

## Context

镇妖十刻是 Vue/Vite 单页应用，同时需要一个很小的匿名统计端点和 Workers Analytics Engine binding。Cloudflare Pages 与 Workers Static Assets 都能托管静态文件，但为两个部署产品拆分前端与统计端点会增加配置和环境管理成本。

## Decision

使用 Cloudflare Workers Static Assets 部署应用，不使用 Cloudflare Pages。

- Vite 构建产物作为 Worker 静态资源发布。
- 使用 Cloudflare 官方 Vite 插件，使本地开发中的 Worker 代码和 bindings 尽量接近生产运行时。
- 同一个 Worker 只处理 `/api/telemetry` 等明确的无业务状态端点。
- 其他请求优先由静态资源服务；未知前端路由回退到 SPA 的 `index.html`。
- 静态资源请求不先运行 Worker 统计逻辑，避免无意义的 Worker 调用。
- Analytics Engine 通过 Worker binding 写入。
- 预览与生产环境使用独立的数据集和配置，防止测试事件污染生产数据。

## Consequences

- 前端静态资源和统计端点可以通过一次部署发布并保持同源。
- 项目需要 Wrangler 配置、明确的 compatibility date 和环境变量/binding 类型。
- `/api/telemetry` 必须实施方法、来源、内容类型、载荷大小、字段和速率限制。
- 预览环境不能依赖 Pages 专属功能，CI/CD 应围绕 Workers 构建与部署。
- 未来若加入云存档等业务后端，需要重新评估安全、身份与数据架构，不能直接扩张统计端点。
