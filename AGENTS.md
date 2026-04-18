# Repository Guidelines

## 项目结构与模块组织
本仓库是一个基于 Vite + React 的静态数据展示应用。主要业务代码位于 `src/`：`main.jsx` 负责启动应用并挂载 `HashRouter`，`App.jsx` 包含目录页、详情页和路由逻辑，`styles.css` 存放全局样式。数据生成脚本位于 `scripts/sync-data.mjs`。原始数据和图片快照位于 `data-source/Resource/园艺/`。生成产物写入 `public/data/`，图片目录会链接到 `public/rhs-images`、`public/mrmaple-images`、`public/herter-images` 和 `public/ncsu-images`。`dist/` 仅作为构建输出目录使用。

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run sync-data`：根据 `data-source/` 重新生成 `public/data/catalog.json`、`public/data/details/*.json` 以及图片符号链接。
- `npm run dev`：先执行数据同步，再启动本地开发服务器，默认地址为 `http://127.0.0.1:4173/`。
- `npm run build`：先执行数据同步，再输出生产构建到 `dist/`。
- `npm run preview`：本地预览构建结果，用于最终冒烟检查。

## 代码风格与命名约定
遵循现有代码风格：使用 ES Modules、React 函数组件、2 空格缩进、双引号和分号。组件使用 `PascalCase`，工具函数使用 `camelCase`，常量使用语义明确的全大写或驼峰命名，例如 `PAGE_SIZE`。品种详情 JSON 文件名和路由参数应与 `id` slug 保持一致，例如 `public/data/details/acer-palmatum-bloodgood.json`。小改动可以继续放在 `src/App.jsx` 中；当界面逻辑继续增长时，应拆分为更聚焦的组件。

## 测试说明
当前仓库未配置自动化测试框架。现阶段将 `npm run build` 作为最基本的回归检查，并通过 `npm run dev` 或 `npm run preview` 手动验证目录页、搜索、分页加载和详情页流程。修改数据生成逻辑后，务必执行 `npm run sync-data`，并抽查 `public/data/details/` 下的若干文件是否正确生成。


## 数据与配置说明
同一功能同时修改源码、`data-source/` 和生成数据时，应一并提交，避免仓库状态不一致。不要提交 `node_modules/` 或 `dist/`。如果后续需要推送大量图片资源到远端仓库，可以评估引入 Git LFS。
