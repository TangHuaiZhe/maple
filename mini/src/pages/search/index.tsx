import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { CultivarCard } from '../../components/CultivarCard'
import { FilterBar } from '../../components/FilterBar'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { matchesCatalogKeyword } from '../../utils/text'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

const PAGE_SIZE = 48

export default function SearchPage() {
  const { items, meta, loading, error } = useCatalog()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const t = UI_STRINGS[locale]
  const categories = meta?.categories?.top_categories || []

  const filtered = items.filter(item => {
    if (category && item.top_category !== category) return false
    return matchesCatalogKeyword(item, debouncedKeyword)
  })
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  if (loading && !items.length) {
    return <View className='page-shell'><Text className='status-text'>{t.common.loading}</Text></View>
  }

  if (error) {
    return <View className='page-shell'><Text className='status-text'>{t.common.error}</Text></View>
  }

  return (
    <View className='page-shell'>
      <View className='page-header'>
        <View className='header-row'>
          <Text className='page-title'>{t.search.title}</Text>
          <LocaleSwitch />
        </View>
      </View>

      <View className='section-card' style={{ marginBottom: '24rpx' }}>
        <FilterBar
          keywordLabel={t.search.keywordLabel}
          keywordPlaceholder={t.search.keywordPlaceholder}
          categoryLabel={t.search.categoryLabel}
          categories={categories}
          selectedCategory={category}
          keyword={keyword}
          allCategoriesLabel={t.search.allCategories}
          onKeywordChange={v => { setKeyword(v); setVisibleCount(PAGE_SIZE) }}
          onCategoryChange={v => { setCategory(v); setVisibleCount(PAGE_SIZE) }}
        />
      </View>

      <Text className='search-summary'>
        {t.search.resultCount.replace('{count}', String(filtered.length))}
      </Text>

      {filtered.length === 0 ? (
        <Text className='status-text'>{t.search.noResults}</Text>
      ) : (
        <View className='search-grid'>
          {visible.map(item => (
            <CultivarCard
              key={item.id}
              item={item}
              locale={locale}
              noImageLabel={t.common.noImage}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </View>
      )}

      {hasMore && (
        <View className='pill-button' onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
          <Text>{t.common.loadMore}</Text>
        </View>
      )}
    </View>
  )
}
