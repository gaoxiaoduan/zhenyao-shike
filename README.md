# 镇妖十刻

《镇妖十刻》是一个凡人修仙主题的原创像素生存构筑游戏。当前公开版本是青石岭核心玩法切片 `v0.1.0`。

试玩地址：<https://zhenyao.33338888.xyz>

## 本地开发

```bash
pnpm install
pnpm dev
```

验证构建和测试：

```bash
pnpm typecheck
pnpm test:run
pnpm test:e2e
```

## Cloudflare 部署

项目使用 Cloudflare Workers Static Assets，不使用 Pages。发布前先执行：

```bash
pnpm run deploy:dry-run
pnpm run deploy
```

Wrangler 配置位于 `wrangler.jsonc`，生产 Custom Domain 为
`zhenyao.33338888.xyz`。首次部署前需要在 Cloudflare 账户中完成 Wrangler 登录。

当前版本的游戏状态、设置和个人历练记录保存在浏览器本地，不提供登录、云存档或全球排行榜。
