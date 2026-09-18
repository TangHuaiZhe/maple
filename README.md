# 日本枫树展示应用 Web + 微信小程序

日本枫树品种百科，涵盖 580 个品种，支持中英文双语、拼音搜索、RHS 获奖筛选、收藏管理。

## 功能

- **品种目录（探索）** — 580 个品种随机浏览，有图优先，支持下拉刷新重新打乱，中英文搜索（含拼音）
- **RHS 获奖** — 29 个英国皇家园艺学会推荐品种，分页加载
- **收藏** — 浏览器 / 小程序本地收藏（无需登录）
- **品种详情** — 养护信息、多源图片画廊（RHS / Mr Maple / Herter / NCSU / Conifer Kingdom / JMAC）
- **分享** — 小程序支持转发给好友和分享到朋友圈
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
- 修改流行品种列表：编辑 `public/data/popular-ids.json`，小程序副本会在 `npm run mini:build` / `npm run mini:dev` 前自动同步
- `npm run build` / `npm run dev` **不会**自动重新生成数据
- 如需从源数据重建：`npm run sync-data`（会覆盖手动修改，慎用）

### 渲染链路与数据准源（Web + 小程序）

- Web 列表页：运行时请求 `/data/catalog.json`（`src/dataUtils.mjs` -> `loadCatalog()`）
- Web 详情页：运行时请求 `/data/details/{id}.json`（`src/dataUtils.mjs` -> `loadCultivar()`）
- Web RHS 获奖页：当前使用 `src/App.jsx` 的 `RHS_AWARD_SELECTIONS` 常量（不读 `awards.json`）
- 小程序列表页：运行时请求 `/data/catalog.json`（`mini/src/services/catalog.ts`）
- 小程序详情页：运行时请求 `/data/details/{id}.json`（`mini/src/services/cultivar.ts`）
- 小程序流行品种：读取包内 `mini/src/pages/popular/popular-ids.json`，由 `npm run sync-mini-popular-ids` 从 `public/data/popular-ids.json` 同步

结论：运行时“最终准源”是 `public/data/catalog.json`（列表）和 `public/data/details/{id}.json`（详情）；`public/data/merged-cultivars.json` 主要用于一致性校验和维护流程。

## 开发

```bash
npm install
npm run dev          # Web 开发服务器
```

## 构建

```bash
npm run build        # Web 生产构建
npm test             # 单元测试
npm run check:data   # 检查数据一致性与图片路径
npm run check:build  # 数据检查 + 单元测试 + Web 构建
npm run image:audit  # 审计图片体积、超大文件、未引用图片
npm run image:thumbs # 预览缩略图生成计划（dry-run，不写文件）
npm run image:thumbs:write # 生成 public/thumbs 下的 WebP 缩略图
```

缩略图默认生成 `w480`、`w960` 两档 WebP 到 `public/thumbs/{source-dir}/{cultivar-id}/{file-base}-w{width}.webp`。默认只处理 `public/data/` 引用到的图片，并跳过小于 250 KB 的非封面源图。常用增量生成：

```bash
npm run image:thumbs -- --source-dir=mrmaple-images
npm run image:thumbs:write -- --source-dir=mrmaple-images --limit=100
npm run image:thumbs:write -- --covers-only # 只为目录封面生成小程序/Web 卡片缩略图
```

## 部署

### Firebase Hosting（当前 Web 线上环境）

本轮已将 Web 站点从腾讯云 CloudBase 迁移到 Firebase Hosting。

- Firebase 项目：`Maple` / `maple-684e2`
- 线上地址：[https://maple-684e2.web.app](https://maple-684e2.web.app)
- 发布规模：约 1.5 GB、9,145 个文件
- 图片策略：Firebase 专用构建会把 `data-source/Resource/园艺/raw/` 下的来源图片复制到 `dist/`，并将图片地址切换为当前站点根路径

Firebase 部署必须使用 `build:firebase`，普通 `npm run build` 只生成 CloudBase/外部图片资源模式的产物：

```bash
npm run build:firebase       # 构建 Web、数据、缩略图和原图发布目录
npm run deploy:firebase      # 构建并部署到 Maple Firebase 项目
```

首次在其他机器上部署：

```bash
npm run firebase:login
npm run firebase:projects
cp .firebaserc.example .firebaserc
# 编辑 .firebaserc，将 default 改成 Firebase 项目 ID
npm run deploy:firebase
```

线上快速验证：

```bash
curl -I -L 'https://maple-684e2.web.app/'
curl -I -L 'https://maple-684e2.web.app/data/catalog.json'
```

Firebase 配置位于 [firebase.json](./firebase.json)，Firebase 模式环境变量位于 `.env.firebase`。原图复制由 `scripts/prepare-firebase-hosting.mjs` 完成；`.firebaserc` 仅保存在本地，不提交到仓库。

### 腾讯云 CloudBase（历史/备用）

原腾讯云 CloudBase 静态托管配置仍保留，主要用于历史环境或回滚参考。当前环境 `cloud1-d0gq8e1gidc917363` 已进入隔离，不作为当前 Web 发布目标。

```bash
npm run build                            # 构建
npm run deploy:cloudbase -- cloud1-d0gq8e1gidc917363 / dist
```

常用增量部署：

```bash
npm run deploy:cloudbase:app          # 构建并上传 index.html + assets
npm run deploy:cloudbase:assets       # 只上传 dist/assets
npm run deploy:cloudbase:data         # 只上传 dist/data
npm run deploy:cloudbase:image-thumbs # 上传 dist/thumbs + dist/data/image-thumbs.json
npm run deploy:cloudbase:thumbs       # 只上传 dist/thumbs
npm run deploy:cloudbase:user-images  # 只上传原始 user-images 目录
npm run deploy:cloudbase:source-images # 首次或新增时上传全部原始图片目录
```

生产构建只携带 `data/` 和 `thumbs/`，不会再次复制约 1 GB 的原图目录。生成或更新缩略图后，先运行 `npm run build`，再用 `npm run deploy:cloudbase:image-thumbs` 上传 `dist/thumbs` 和 `dist/data/image-thumbs.json`。首次部署或新增原图时，再运行 `npm run deploy:cloudbase:source-images`。

#### 增量上传图片目录

只新增或修改 `user-images` 图片时，可单独上传该目录，避免重传整套图片资产：

```bash
npm run deploy:cloudbase:user-images
```

#### 线上图片不显示排查流程

如果本地图片正常、线上详情页不显示图片，按下面顺序排查：

1. 确认线上图片文件是否存在：

   ```bash
   curl -I -L 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/user-images/{id}/01-example.webp'
   ```

   若返回 `404`，执行上面的 `user-images` 增量上传命令。

2. 确认线上详情 JSON 已指向图片：

   ```bash
   curl -s 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/data/details/{id}.json' | rg 'user-images|public_user_paths|public_cover_path'
   ```

3. 如果图片 URL 已经返回 `200`，但页面仍不显示，多半是浏览器/CDN 缓存过旧的 `404`。检查 `src/App.jsx`：
   - `shouldAppendCacheBust()` 必须包含 `user-images`
   - `resolveRecordAssetPaths()` 的 `imageKeys` 必须包含 `public_user_paths`
   - 更新 `DEPLOY_CACHE_BUST`，例如 `20260808-1`

4. 重新构建并部署入口与资源：

   ```bash
   npm run build
   tcb hosting deploy dist/assets /assets -e cloud1-d0gq8e1gidc917363
   tmp_dir="$(mktemp -d)" && cp dist/index.html "$tmp_dir/" && tcb hosting deploy "$tmp_dir" / -e cloud1-d0gq8e1gidc917363 && rm -rf "$tmp_dir"
   ```

5. 验证线上入口和带版本参数的图片：

   ```bash
   curl -s -H 'Cache-Control: no-cache' 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/?probe=1' | rg 'assets/index-.*\.js'
   curl -I -L 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/user-images/{id}/01-example.webp?v=20260808-1'
   ```

   若裸首页仍短暂返回旧 JS，可等待 CDN 刷新；必要时临时把新 JS 内容覆盖到旧的 `assets/index-*.js` 文件名。

## 微信小程序

小程序位于 `mini/`，技术栈 Taro 4.2.0 + React 18 + TypeScript。

```bash
cd mini && npm install
npm run mini:build   # 生产构建（单次）
npm run mini:dev     # 监听模式：修改源文件自动重编译，配合微信开发者工具实时预览
```

在微信开发者工具中打开 `mini/` 目录（`miniprogramRoot` 指向 `dist/`）。

小程序页面：popular（流行）、catalog（探索）、awards（获奖）、favorites（收藏）、cultivar-detail（详情）

小程序 Tab：流行 / 探索 / RHS 获奖 / 收藏

小程序端也已切换到 Firebase Hosting：`mini/.env.development` 和 `mini/.env.production` 的数据、图片地址均为 `https://maple-684e2.web.app`。Firebase 只提供小程序运行时读取的 JSON 和图片资源，小程序包仍通过微信开发者工具上传和发布。

如果微信开发者工具开启了域名校验，需要将 `https://maple-684e2.web.app` 配置为小程序的合法 request 域名；本地开发可继续使用开发者工具的校验豁免。

### 小程序关键配置

- `config/index.ts` — **不要**设置 `runtimeChunk(false)`，Taro 默认的 `runtimeChunk: { name: 'runtime' }` 是必须的
- `project.config.json` — `es6: false`、`enhance: false`（Taro 产物不需要二次编译）

## Git

- 提交：源代码 + `public/data/` + `data-source/`
- 忽略：`node_modules/`、`dist/`、`mini/dist/`、`mini/node_modules/`
- 图片资产较大，推远端时建议考虑 Git LFS
