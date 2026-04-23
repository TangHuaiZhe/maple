## 数据

- `public/data/` 下的 JSON 是最终数据，直接编辑维护
- `npm run build` / `npm run dev` 不会触发 sync-data
- 修改品种信息需同时更新 `catalog.json`、`details/{id}.json`、`merged-cultivars.json`
- `npm run sync-data` 会从 `data-source/` 重建数据，覆盖手动修改，慎用

## 小程序 (mini/)

- Taro 4.2.0 + React 18 + TypeScript + Webpack 5
- **绝不**在 `config/index.ts` 中设置 `chain.optimization.runtimeChunk(false)`，会导致页面模块与 app 模块缓存隔离，`Current.app` 为 null
- `project.config.json` 中 `es6` 和 `enhance` 必须为 `false`
- 流行品种 ID 列表维护在 `mini/src/pages/popular/index.tsx` 的 `POPULAR_IDS` 和 `src/App.jsx` 的 `POPULAR_IDS`

## 部署

- CloudBase 环境 ID：`cloud1-d0gq8e1gidc917363`
- 部署命令：`npm run deploy:cloudbase -- cloud1-d0gq8e1gidc917363 / dist`
- 小程序数据源：`https://cloud1-d0gq8e1gidc917363-1309536005.tcloudbaseapp.com`

## 品种列表

- 流行品种：51 个，定义在 `POPULAR_IDS`
- RHS 获奖：29 个，定义在 `RHS_AWARD_SELECTIONS`
- 两个列表在 web (`src/App.jsx`) 和小程序 (`mini/src/pages/`) 中各有一份

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
