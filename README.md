# 日本枫树展示应用 Web

这个项目现在已经脱离 Obsidian vault，作为独立 Web 应用单独维护。

当前已实现：

- 首页品种目录
- 中英文与拼音搜索
- 自动分页加载
- 品种详情页
- RHS / Mr Maple / 本地图片展示
- 基于静态数据的目录页与详情页拆分加载

## 目录

- `src/App.jsx`
  主应用、路由和页面实现
- `src/styles.css`
  页面样式
- `scripts/sync-data.mjs`
  从项目内 `data-source/` 生成 `public/data/`，并把图片目录链接到 `public/`
- `data-source/`
  本项目自带的数据快照与原始图片资产

## 命令

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:4173/
```

构建：

```bash
npm run build
```

## 数据说明

- 项目不再依赖 Obsidian vault 内的 `Resource/园艺/`
- 原始 JSON 和图片已经复制到项目内的 `data-source/`
- `npm run sync-data` 会基于本地 `data-source/` 重新生成目录数据、详情数据和图片链接

## 当前实现说明

- 应用使用 `HashRouter`
- `npm run dev` 和 `npm run build` 都会先执行 `npm run sync-data`
- 首页使用 `catalog.json` 轻量加载
- 详情页按 `id` 单独请求 `public/data/details/*.json`

## Git 提示

- 建议提交源代码、`public/data/` 和 `data-source/`
- `node_modules/` 与 `dist/` 已加入 `.gitignore`
- 图片资产较大，后续如果要推到远端仓库，建议考虑 Git LFS
