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
- `npm run deploy:cloudbase -- cloud1-d0gq8e1gidc917363 / dist` — 部署到腾讯云
- `tcb hosting deploy dist/user-images /user-images -e cloud1-d0gq8e1gidc917363` — 增量上传用户图片目录（先运行 `npm run build`）
- `npm run mini:build` — 构建微信小程序（单次）
- `npm run mini:dev` — 小程序监听模式：修改 `mini/src/` 源文件后自动重新编译到 `mini/dist/`，配合微信开发者工具实时预览
- `npm run sync-data` — 从 `data-source/` 重建 `public/data/`（会覆盖手动修改，慎用）

## 数据维护
- `public/data/` 下的 JSON 是最终产物，修改品种信息需同时更新 `catalog.json`、`details/{id}.json`、`merged-cultivars.json`
- 流行品种 ID 列表：`src/App.jsx` 的 `POPULAR_IDS` 和 `mini/src/pages/popular/index.tsx` 的 `POPULAR_IDS`
- RHS 获奖列表：`src/App.jsx` 的 `RHS_AWARD_SELECTIONS`

## 线上图片故障排查
- 本地有图、线上无图时，先 `curl -I -L` 检查线上图片 URL 是否 `200`；若是 `404`，运行 `npm run build` 后用 `tcb hosting deploy dist/user-images /user-images -e cloud1-d0gq8e1gidc917363` 增量上传
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
