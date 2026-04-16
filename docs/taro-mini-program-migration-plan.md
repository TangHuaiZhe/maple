# 微信小程序 Taro 迁移计划

## 目标

将当前 Web 应用迁移为微信小程序，保留现有数据生产链，重建展示层。首版优先保证目录浏览、详情展示、搜索筛选、中英文切换和图片预览可用，再做性能优化和发布收尾。

## 技术选型

- 前端框架：`Taro + React + TypeScript`
- 样式方案：页面级 `scss` 或 `scss module`
- 数据来源：继续使用现有 `scripts/sync-data.mjs` 生成的数据
- 静态资源：JSON 和图片建议托管到远端静态服务，不放入小程序包体

选择 Taro 的原因是当前项目已基于 React，页面状态和数据映射逻辑更容易迁移，首版开发效率和后续维护成本更可控。

## 数据策略

现有 Web 端主要消费：

- `public/data/catalog.json`
- `public/data/details/*.json`

迁移时继续沿用这套结构，但增加小程序友好的约束：

- 目录页只请求 `catalog.json`
- 详情页按 `id` 懒加载单条 `details/*.json`
- 图片统一走 CDN URL
- 不将全量详情和图片打进小程序主包

建议后续补充：

- `public/data/meta.json`：全局分类、奖项、版本号
- `public/data/awards.json`：RHS 获奖品种列表

## 小程序目录结构

```text
mini/
  src/
    app.config.ts
    app.tsx
    pages/
      catalog/
      search/
      awards/
      cultivar-detail/
    components/
      CultivarCard/
      LocaleSwitch/
      DescriptionBlock/
      InfoSection/
      GalleryGrid/
      FilterBar/
    services/
      api.ts
      catalog.ts
      cultivar.ts
    hooks/
      useLocale.ts
      useCatalog.ts
      useCultivarDetail.ts
    types/
      catalog.ts
      detail.ts
    utils/
      fields.ts
      image.ts
      locale.ts
      text.ts
```

## 页面拆分

### 1. 目录页 `pages/catalog`

- 展示品种卡片列表
- 支持首屏搜索和分页加载
- 卡片展示封面、英文名、中文名、来源标记

### 2. 搜索页 `pages/search`

- 按分类和关键词筛选
- 复用目录卡片组件
- 首版也可以与目录页合并，后续再独立

### 3. 获奖页 `pages/awards`

- 展示 RHS 获奖品种
- 首版不做分类，直接平铺展示

### 4. 详情页 `pages/cultivar-detail`

- 标题和中英文切换
- 基本信息
- RHS 信息
- 描述折叠
- 图片画廊和图片预览

## 组件拆分

- `CultivarCard`：目录/搜索/获奖页卡片
- `LocaleSwitch`：全局中英文切换
- `DescriptionBlock`：简介和完整描述折叠
- `InfoSection`：基本信息与 RHS 信息块
- `GalleryGrid`：图片分页加载和预览入口
- `FilterBar`：分类与关键词筛选

## 实施步骤

### 阶段一：基础骨架

1. 建立 Taro 项目
2. 配置页面路由
3. 抽取 `CatalogItem` 和 `CultivarDetail` 类型

### 阶段二：核心页面

1. 接入 `catalog.json`
2. 完成目录页
3. 接入详情 JSON
4. 完成详情页基础展示

### 阶段三：功能补齐

1. 加入中英文切换
2. 加入搜索与筛选
3. 加入 RHS 获奖页
4. 加入图片预览和画廊分页

### 阶段四：优化与发布

1. 控制主包体积
2. 优化图片加载和缓存
3. 检查长列表性能
4. 进行真机测试和发布

## 风险与约束

- 图片数量大，必须外置托管
- 详情数据较重，必须按需加载
- 不能把当前 `src/App.jsx` 的整页逻辑直接平移，应先拆组件
- 若后续发现个别页面性能瓶颈，再评估局部原生化

## 当前结论

首版采用 `Taro + React + TypeScript` 最合适。先迁移目录页和详情页，再逐步补齐搜索、奖项页和性能优化，风险最低，推进速度也最快。
