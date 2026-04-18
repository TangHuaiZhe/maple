# 日本枫树展示应用 Web

这个项目现在已经脱离 Obsidian vault，作为独立 Web 应用单独维护。

当前已实现：

- 首页品种目录
- 中英文与拼音搜索
- 自动分页加载
- 品种详情页
- RHS / Mr Maple / Herter / NCSU 图片展示
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

腾讯云 / CloudBase 根路径部署：

```bash
npm run build
npm run deploy:cloudbase -- cloud1-xxxx / dist
```

如果上传大量图片时偶发断开，可以增加重试次数：

```bash
MAX_RETRIES=5 npm run deploy:cloudbase -- cloud1-xxxx / dist
```

小程序构建：

```bash
npm run mini:build
```

小程序开发监听：

```bash
npm run mini:dev
```

## 数据说明

- 项目不再依赖 Obsidian vault 内的 `Resource/园艺/`
- 原始 JSON 和图片已经复制到项目内的 `data-source/`
- `npm run sync-data` 会基于本地 `data-source/` 重新生成目录数据、详情数据和图片链接
- 同步后还会额外生成：
  - `public/data/meta.json`
  - `public/data/awards.json`

## 当前实现说明

- 应用使用 `HashRouter`
- `npm run dev` 和 `npm run build` 都会先执行 `npm run sync-data`
- 首页使用 `catalog.json` 轻量加载
- 详情页按 `id` 单独请求 `public/data/details/*.json`

## 微信小程序

- 小程序工程位于 `mini/`
- 技术栈为 `Taro + React + TypeScript`
- 页面包括：
  - `pages/catalog`
  - `pages/search`
  - `pages/awards`
  - `pages/cultivar-detail`
- 小程序默认读取当前 Web 开发数据地址：
  - `http://127.0.0.1:4173`
- 生产环境静态资源地址需要手动修改：
  - `mini/.env.production`

推荐开发顺序：

```bash
npm run dev
npm run mini:dev
```

然后在微信开发者工具中打开 `mini/dist/`。

注意：

- 小程序开发环境不要使用 `127.0.0.1` 作为数据地址
- 当前开发地址已写入 `mini/.env.development`
- 如果你的电脑局域网 IP 变化，需要同步修改：
  - `mini/.env.development`

## Git 提示

- 建议提交源代码、`public/data/` 和 `data-source/`
- `node_modules/` 与 `dist/` 已加入 `.gitignore`
- 图片资产较大，后续如果要推到远端仓库，建议考虑 Git LFS
