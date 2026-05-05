# Repository Guidelines

## 项目结构
- `src/App.jsx` — Web 应用（React + React Router，HashRouter）
- `src/styles.css` — Web 样式
- `mini/` — 微信小程序（Taro 4 + React + TypeScript）
- `public/data/` — **最终数据**，直接编辑维护，构建不会覆盖
- `data-source/` — 原始数据快照与图片资产
- `scripts/` — 数据同步与图片抓取脚本（仅手动按需使用）

## 开发命令
- `npm run dev` — 启动 Web 开发服务器
- `npm run build` — Web 生产构建到 `dist/`
- `npm test` — 运行 Node 单元测试
- `npm run check:data` — 检查 `public/data/` 一致性与图片路径是否存在
- `npm run check:build` — 数据检查 + 单元测试 + Web 构建
- `npm run image:audit` — 审计图片目录体积、超大文件、未引用图片
- `npm run image:thumbs` — 预览缩略图生成计划（dry-run，不写文件）
- `npm run image:thumbs:write` — 生成 `public/thumbs` WebP 缩略图
- `npm run sync-mini-popular-ids` — 从 `public/data/popular-ids.json` 同步小程序流行品种列表
- `npm run deploy:cloudbase -- cloud1-d0gq8e1gidc917363 / dist` — 部署到腾讯云
- `npm run deploy:cloudbase:app` — 构建并增量上传 `index.html` 与 `assets`
- `npm run deploy:cloudbase:data` — 增量上传 `dist/data`
- `npm run deploy:cloudbase:image-thumbs` — 增量上传 `dist/thumbs` 和 `dist/data/image-thumbs.json`
- `npm run deploy:cloudbase:thumbs` — 增量上传 `dist/thumbs`（先运行 `npm run build`）
- `npm run deploy:cloudbase:user-images` — 增量上传 `dist/user-images`（先运行 `npm run build`）
- `npm run mini:build` — 构建微信小程序（单次）
- `npm run mini:dev` — 小程序监听模式：修改 `mini/src/` 源文件后自动重新编译到 `mini/dist/`，配合微信开发者工具实时预览
- `npm run sync-data` — 从 `data-source/` 重建 `public/data/`（会覆盖手动修改，慎用）

## 数据维护
- `public/data/` 下的 JSON 是最终产物，修改品种信息需同时更新 `catalog.json`、`details/{id}.json`、`merged-cultivars.json`
- 流行品种 ID 列表：以 `public/data/popular-ids.json` 为源；小程序副本由 `npm run sync-mini-popular-ids` 同步
- RHS 获奖列表：`src/App.jsx` 的 `RHS_AWARD_SELECTIONS`

## 渲染链路与数据准源
- Web 启动时读取 `/data/catalog.json`（`src/dataUtils.mjs` 的 `loadCatalog()`），用于列表页渲染
- Web 详情页读取 `/data/details/{id}.json`（`src/dataUtils.mjs` 的 `loadCultivar()`）
- Web `popular` 使用 `src/App.jsx` 中导入的 `public/data/popular-ids.json`（构建时打包）
- Web `RHS 获奖` 当前使用 `src/App.jsx` 的 `RHS_AWARD_SELECTIONS` 常量（非 `awards.json`）
- 小程序列表读取 `/data/catalog.json`（`mini/src/services/catalog.ts`）
- 小程序详情读取 `/data/details/{id}.json`（`mini/src/services/cultivar.ts`）
- 小程序 `popular` 读取包内 `mini/src/pages/popular/popular-ids.json`，由 `npm run sync-mini-popular-ids` 从 `public/data/popular-ids.json` 同步
- 因此运行时最终准源是：列表看 `public/data/catalog.json`，详情看 `public/data/details/{id}.json`；`merged-cultivars.json` 主要用于一致性校验与数据维护

## 图片与缩略图
- 原图保留在 `public/{source-images}/...`，不要为了缩略图改写原图路径
- 缩略图生成到 `public/thumbs/{source-dir}/{cultivar-id}/{file-base}-w480.webp` 和 `-w960.webp`
- 先用 `npm run image:thumbs -- --source-dir=mrmaple-images` 看计划，再用 `npm run image:thumbs:write -- --source-dir=mrmaple-images` 写入
- 缩略图默认只处理 `public/data/` 引用图片，跳过小于 250 KB 的非封面源图；可用 `--all` 全量处理
- 生成命令会写 `public/data/image-thumbs.json`，前端只对 manifest 中存在的图片使用缩略图，lightbox 仍使用原图
- 生成后运行 `npm run build`，再用 `npm run deploy:cloudbase:image-thumbs` 增量上传缩略图与 manifest

## 线上图片故障排查
- 本地有图、线上无图时，先 `curl -I -L` 检查线上图片 URL 是否 `200`；若是 `404`，运行 `npm run build` 后用 `npm run deploy:cloudbase:user-images` 增量上传
- 若图片 URL 已是 `200` 但页面仍不显示，检查线上详情 JSON 是否包含 `public_user_paths` / `public_cover_path`
- 旧 `404` 可能被浏览器/CDN 缓存；此时在 `src/App.jsx` 中确保 `shouldAppendCacheBust()` 包含 `user-images`，`resolveRecordAssetPaths()` 的 `imageKeys` 包含 `public_user_paths`，并递增 `DEPLOY_CACHE_BUST`
- cache-bust 修改后运行 `npm run build`，至少部署 `dist/assets` 和根 `index.html`；用 `curl -s -H 'Cache-Control: no-cache' <线上首页>` 验证入口 JS 已更新

## 代码风格
ES Modules、React 函数组件、2 空格缩进、双引号、分号。组件 `PascalCase`，工具函数 `camelCase`，常量 `PAGE_SIZE` 风格。品种 JSON 文件名与 `id` slug 一致。

## 小程序注意事项
- `mini/config/index.ts` 中**不要**设置 `runtimeChunk(false)`
- `mini/project.config.json` 中 `es6: false`、`enhance: false`

## 测试
无自动化测试。通过 `npm run dev` 手动验证目录页、搜索、详情页、收藏功能。
