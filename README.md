# 日本枫树展示应用 Web + 微信小程序

日本枫树品种百科，涵盖 580 个品种，支持中英文双语、拼音搜索、RHS 获奖筛选、收藏管理。

## 功能

- **品种目录** — 580 个品种浏览，中英文搜索（含拼音）
- **流行品种** — 51 个最受欢迎的经典品种
- **RHS 获奖** — 29 个英国皇家园艺学会推荐品种
- **收藏** — 浏览器 / 小程序本地收藏（无需登录）
- **品种详情** — RHS 种植信息、多源图片画廊（RHS / Mr Maple / Herter / NCSU / Conifer Kingdom / JMAC）
- **双语** — 中文 / 英文切换

## 目录结构

```
src/App.jsx          Web 应用（React + React Router）
src/styles.css       Web 样式
mini/                微信小程序（Taro 4 + React + TypeScript）
public/data/         数据文件（直接维护，不由脚本生成）
  catalog.json       品种列表（580 条，含搜索索引）
  awards.json        获奖品种（29 条）
  meta.json          元数据（计数、分类）
  details/*.json     单品种详情（580 个文件）
  merged-cultivars.json  完整合并数据
data-source/         原始数据快照与图片资产
scripts/             数据同步与图片抓取脚本（仅在需要从源数据重建时使用）
```

## 数据维护

`public/data/` 下的 JSON 文件是**最终数据**，直接编辑维护。

- 修改品种中文名：编辑 `catalog.json` + `details/{id}.json` + `merged-cultivars.json`
- `npm run build` / `npm run dev` **不会**自动重新生成数据
- 如需从源数据重建：`npm run sync-data`（会覆盖手动修改，慎用）

## 开发

```bash
npm install
npm run dev          # Web 开发服务器
```

## 构建

```bash
npm run build        # Web 生产构建
```

## 部署

腾讯云 CloudBase 静态托管：

```bash
npm run build                            # 构建
npm run deploy:cloudbase -- cloud1-d0gq8e1gidc917363 / dist
```

## 微信小程序

小程序位于 `mini/`，技术栈 Taro 4.2.0 + React 18 + TypeScript。

```bash
cd mini && npm install
npm run mini:build   # 生产构建（单次）
npm run mini:dev     # 监听模式：修改源文件自动重编译，配合微信开发者工具实时预览
```

在微信开发者工具中打开 `mini/` 目录（`miniprogramRoot` 指向 `dist/`）。

小程序页面：catalog（首页）、popular（流行）、search（筛选）、awards（获奖）、favorites（收藏）、cultivar-detail（详情）

数据源地址配置：`mini/.env.development` / `mini/.env.production`

### 小程序关键配置

- `config/index.ts` — **不要**设置 `runtimeChunk(false)`，Taro 默认的 `runtimeChunk: { name: 'runtime' }` 是必须的
- `project.config.json` — `es6: false`、`enhance: false`（Taro 产物不需要二次编译）

## Git

- 提交：源代码 + `public/data/` + `data-source/`
- 忽略：`node_modules/`、`dist/`、`mini/dist/`、`mini/node_modules/`
- 图片资产较大，推远端时建议考虑 Git LFS
