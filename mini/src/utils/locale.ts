import type { CultivarDetail } from '../types/detail'
import type { Locale } from '../types/catalog'

export function getLocalizedDetail(detail: CultivarDetail, locale: Locale): CultivarDetail {
  if (locale === 'en') return detail
  return {
    ...detail,
    rhs: detail.rhs_zh
      ? { ...detail.rhs, ...detail.rhs_zh }
      : detail.rhs,
    descriptions: detail.descriptions_zh
      ? { ...detail.descriptions, ...detail.descriptions_zh }
      : detail.descriptions
  }
}

export function getPrimaryName(locale: Locale, displayName: string, chineseName?: string | null): string {
  if (locale === 'zh' && chineseName) return chineseName
  return displayName
}

export function getSecondaryName(locale: Locale, displayName: string, chineseName?: string | null): string {
  if (locale === 'zh') return displayName
  return chineseName || ''
}

export const UI_STRINGS = {
  zh: {
    common: {
      loading: '加载中…',
      error: '加载失败，请重试',
      noImage: '暂无图片',
      loadMore: '加载更多',
      noMore: '没有更多了',
      items: '个品种',
      all: '全部',
    },
    catalog: {
      title: '日本枫树图鉴',
      subtitle: '品种大全',
      searchPlaceholder: '搜索品种名称…',
      noResults: '未找到匹配的品种',
      eyebrow: '品种图鉴',
    },
    search: {
      title: '筛选搜索',
      keywordLabel: '关键词',
      keywordPlaceholder: '输入品种名称…',
      categoryLabel: '分类',
      allCategories: '全部分类',
      resultCount: '找到 {count} 个品种',
      noResults: '未找到匹配的品种',
    },
    awards: {
      title: 'RHS 获奖品种',
      subtitle: '英国皇家园艺学会推荐',
      count: '{count} 个获奖品种',
    },
    favorites: {
      title: '我的收藏',
      subtitle: '已收藏的品种',
      empty: '还没有收藏任何品种',
      emptyHint: '浏览品种图鉴，点击心形图标收藏喜欢的品种',
      browseCatalog: '浏览品种',
      count: '{count} 个收藏',
    },
    detail: {
      title: '品种详情',
      basicInfo: '基本信息',
      description: '品种描述',
      rhsInfo: 'RHS 种植信息',
      gallery: '图片',
      summaryLabel: '简介',
      fullLabel: '详细描述',
      showFull: '展开全文',
      hideFull: '收起',
      emptyDesc: '暂无描述信息',
      nameLabel: '标准名',
      chineseNameLabel: '中文名',
      scientificNameLabel: '学名',
      speciesLabel: '物种',
      categoryLabel: '大类',
      groupLabel: '品种群',
      imageCountLabel: '图片数',
      sourceCountLabel: '数据源',
      botanicalNameLabel: '植物学名',
      heightLabel: '高度',
      spreadLabel: '冠幅',
      sizeLabel: '尺寸',
      timeToFullLabel: '成长周期',
      hardinessLabel: '耐寒性',
      sunlightLabel: '光照',
      soilTypeLabel: '土壤',
      aspectLabel: '朝向',
      moistureLabel: '水分',
      phLabel: '酸碱度',
      exposureLabel: '暴露度',
      plantTypeLabel: '植物类型',
      habitLabel: '生长习性',
      foliageLabel: '叶片类型',
      suggestedUsesLabel: '推荐用途',
    },
  },
  en: {
    common: {
      loading: 'Loading…',
      error: 'Failed to load. Please retry.',
      noImage: 'No image',
      loadMore: 'Load more',
      noMore: 'No more items',
      items: ' cultivars',
      all: 'All',
    },
    catalog: {
      title: 'Japanese Maple Encyclopedia',
      subtitle: 'All Cultivars',
      searchPlaceholder: 'Search cultivar name…',
      noResults: 'No matching cultivars found',
      eyebrow: 'Cultivar Encyclopedia',
    },
    search: {
      title: 'Filter & Search',
      keywordLabel: 'Keyword',
      keywordPlaceholder: 'Enter cultivar name…',
      categoryLabel: 'Category',
      allCategories: 'All Categories',
      resultCount: '{count} cultivars found',
      noResults: 'No matching cultivars found',
    },
    awards: {
      title: 'RHS Award Winners',
      subtitle: 'Recommended by the Royal Horticultural Society',
      count: '{count} award winners',
    },
    favorites: {
      title: 'My Favorites',
      subtitle: 'Saved cultivars',
      empty: 'No saved cultivars yet',
      emptyHint: 'Browse the catalog and tap the heart icon to save cultivars',
      browseCatalog: 'Browse Catalog',
      count: '{count} saved',
    },
    detail: {
      title: 'Cultivar Detail',
      basicInfo: 'Basic Info',
      description: 'Description',
      rhsInfo: 'RHS Growing Info',
      gallery: 'Gallery',
      summaryLabel: 'Summary',
      fullLabel: 'Full Description',
      showFull: 'Show full text',
      hideFull: 'Collapse',
      emptyDesc: 'No description available',
      nameLabel: 'Name',
      chineseNameLabel: 'Chinese Name',
      scientificNameLabel: 'Scientific Name',
      speciesLabel: 'Species',
      categoryLabel: 'Category',
      groupLabel: 'Group',
      imageCountLabel: 'Images',
      sourceCountLabel: 'Sources',
      botanicalNameLabel: 'Botanical Name',
      heightLabel: 'Height',
      spreadLabel: 'Spread',
      sizeLabel: 'Size',
      timeToFullLabel: 'Time to Full Height',
      hardinessLabel: 'Hardiness',
      sunlightLabel: 'Sunlight',
      soilTypeLabel: 'Soil Type',
      aspectLabel: 'Aspect',
      moistureLabel: 'Moisture',
      phLabel: 'pH',
      exposureLabel: 'Exposure',
      plantTypeLabel: 'Plant Type',
      habitLabel: 'Habit',
      foliageLabel: 'Foliage',
      suggestedUsesLabel: 'Suggested Uses',
    },
  },
} as const
