# 日本枫树展示应用 Web + 微信小程序

日本枫树品种百科，涵盖 580 个品种，支持中英文双语、拼音搜索、RHS 获奖筛选、收藏管理。

## 功能

- **品种目录（探索）** — 580 个品种随机浏览，有图优先，支持下拉刷新重新打乱，中英文搜索（含拼音）
- **流行品种** — 51 个最受欢迎的经典品种，支持全品种搜索
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
```

## 部署

腾讯云 CloudBase 静态托管：

```bash
npm run build                            # 构建
npm run deploy:cloudbase -- cloud1-d0gq8e1gidc917363 / dist
```

常用增量部署：

```bash
npm run deploy:cloudbase:app          # 构建并上传 index.html + assets
npm run deploy:cloudbase:assets       # 只上传 dist/assets
npm run deploy:cloudbase:data         # 只上传 dist/data
npm run deploy:cloudbase:user-images  # 只上传 dist/user-images
```

### 增量上传图片目录

只新增或修改 `user-images` 图片时，可在 `npm run build` 后单独上传该目录，避免重传整套图片资产：

```bash
npm run deploy:cloudbase:user-images
```

### 线上图片不显示排查流程

如果本地图片正常、线上详情页不显示图片，按下面顺序排查：

1. 确认线上图片文件是否存在：

   ```bash
   curl -I -L 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/user-images/{id}/01-example.webp'
   ```

   若返回 `404`，先运行 `npm run build`，再执行上面的 `dist/user-images` 增量上传命令。

2. 确认线上详情 JSON 已指向图片：

   ```bash
   curl -s 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/data/details/{id}.json' | rg 'user-images|public_user_paths|public_cover_path'
   ```

3. 如果图片 URL 已经返回 `200`，但页面仍不显示，多半是浏览器/CDN 缓存过旧的 `404`。检查 `src/App.jsx`：
   - `shouldAppendCacheBust()` 必须包含 `user-images`
   - `resolveRecordAssetPaths()` 的 `imageKeys` 必须包含 `public_user_paths`
   - 更新 `DEPLOY_CACHE_BUST`，例如 `20260502-1`

4. 重新构建并部署入口与资源：

   ```bash
   npm run build
   tcb hosting deploy dist/assets /assets -e cloud1-d0gq8e1gidc917363
   tmp_dir="$(mktemp -d)" && cp dist/index.html "$tmp_dir/" && tcb hosting deploy "$tmp_dir" / -e cloud1-d0gq8e1gidc917363 && rm -rf "$tmp_dir"
   ```

5. 验证线上入口和带版本参数的图片：

   ```bash
   curl -s -H 'Cache-Control: no-cache' 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/?probe=1' | rg 'assets/index-.*\.js'
   curl -I -L 'https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com/user-images/{id}/01-example.webp?v=20260502-1'
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

数据源地址配置：`mini/.env.development` / `mini/.env.production`

### 小程序关键配置

- `config/index.ts` — **不要**设置 `runtimeChunk(false)`，Taro 默认的 `runtimeChunk: { name: 'runtime' }` 是必须的
- `project.config.json` — `es6: false`、`enhance: false`（Taro 产物不需要二次编译）

## Git

- 提交：源代码 + `public/data/` + `data-source/`
- 忽略：`node_modules/`、`dist/`、`mini/dist/`、`mini/node_modules/`
- 图片资产较大，推远端时建议考虑 Git LFS
