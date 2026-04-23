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
- `npm run mini:build` — 构建微信小程序（单次）
- `npm run mini:dev` — 小程序监听模式：修改 `mini/src/` 源文件后自动重新编译到 `mini/dist/`，配合微信开发者工具实时预览
- `npm run sync-data` — 从 `data-source/` 重建 `public/data/`（会覆盖手动修改，慎用）

## 数据维护
- `public/data/` 下的 JSON 是最终产物，修改品种信息需同时更新 `catalog.json`、`details/{id}.json`、`merged-cultivars.json`
- 流行品种 ID 列表：`src/App.jsx` 的 `POPULAR_IDS` 和 `mini/src/pages/popular/index.tsx` 的 `POPULAR_IDS`
- RHS 获奖列表：`src/App.jsx` 的 `RHS_AWARD_SELECTIONS`

## 代码风格
ES Modules、React 函数组件、2 空格缩进、双引号、分号。组件 `PascalCase`，工具函数 `camelCase`，常量 `PAGE_SIZE` 风格。品种 JSON 文件名与 `id` slug 一致。

## 小程序注意事项
- `mini/config/index.ts` 中**不要**设置 `runtimeChunk(false)`
- `mini/project.config.json` 中 `es6: false`、`enhance: false`

## 测试
无自动化测试。通过 `npm run dev` 手动验证目录页、搜索、详情页、收藏功能。
