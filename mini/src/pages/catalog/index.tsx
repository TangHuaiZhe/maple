import { useState, useMemo, useCallback } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useShareAppMessage, usePullDownRefresh, stopPullDownRefresh } from '@tarojs/taro'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { filterDiscoveryItems } from '../../utils/discovery'
import { matchesCatalogKeyword } from '../../utils/text'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

const LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
const PAGE_SIZE = 40
function getLatinSortLabel(item: { display_name?: string; canonical_name?: string; scientific_name?: string }) {
  const candidates = [item.display_name, item.canonical_name, item.scientific_name]
  for (const candidate of candidates) {
    if (!candidate) continue
    if (/[A-Za-z]/.test(candidate)) return candidate
  }
  return candidates.find(Boolean) || ''
}

function getAlphaGroup(item: { display_name?: string; canonical_name?: string; scientific_name?: string }) {
  const label = getLatinSortLabel(item)
  const match = label.match(/[A-Za-z]/)
  return match ? match[0].toUpperCase() : '#'
}

export default function CatalogPage() {
  const { items, loading, error } = useCatalog()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  useShareAppMessage(() => ({
    title: '日本枫树 - 品种目录',
    path: '/pages/catalog/index'
  }))
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const t = UI_STRINGS[locale]

  const sorted = useMemo(() => {
    const visibleItems = filterDiscoveryItems(items, false)
    return visibleItems
      .slice()
      .sort((left, right) => getLatinSortLabel(left).localeCompare(getLatinSortLabel(right), 'en', { sensitivity: 'base', numeric: true }))
  }, [items])

  const filtered = useMemo(() => (
    debouncedKeyword
      ? sorted.filter(item => matchesCatalogKeyword(item, debouncedKeyword))
      : sorted
  ), [sorted, debouncedKeyword])
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const grouped = useMemo(() => {
    const sections = new Map<string, typeof visible>()
    for (const item of visible) {
      const group = getAlphaGroup(item)
      const current = sections.get(group) || []
      current.push(item)
      sections.set(group, current)
    }

    return [...LETTERS, '#']
      .map(letter => ({ letter, items: sections.get(letter) || [] }))
      .filter(section => section.items.length > 0)
  }, [visible])

  const handleRefresh = useCallback(() => {
    setKeyword('')
    setVisibleCount(PAGE_SIZE)
    stopPullDownRefresh()
  }, [])

  usePullDownRefresh(handleRefresh)

  if (loading && !items.length) {
    return <View className='page-shell'><Text className='status-text'>{t.common.loading}</Text></View>
  }

  if (error) {
    return <View className='page-shell'><Text className='status-text'>{t.common.error}</Text></View>
  }

  return (
    <View className='page-shell catalog-page'>
      <View className='page-header'>
        <View className='header-row'>
          <View>
            <Text className='page-eyebrow'>{t.catalog.eyebrow}</Text>
            <Text className='page-title'>{t.catalog.title}</Text>
            <Text className='page-subtitle'>{t.catalog.subtitle}</Text>
          </View>
          <LocaleSwitch />
        </View>
        <Text className='meta-chip' style={{ marginTop: '16rpx' }}>
          {visible.length}/{sorted.length}{t.common.items}
        </Text>
      </View>

      <View className='catalog-search'>
        <Input
          className='catalog-search__input'
          type='text'
          placeholder={t.catalog.searchPlaceholder}
          value={keyword}
          onInput={e => { setKeyword(e.detail.value); setVisibleCount(PAGE_SIZE) }}
        />
      </View>

      <ScrollView
        className='catalog-scroll'
        scrollY
        enhanced
        showScrollbar={false}
        lowerThreshold={160}
        onScrollToLower={() => { if (hasMore) setVisibleCount(c => c + PAGE_SIZE) }}
      >
        {filtered.length === 0 ? (
          <Text className='status-text'>{t.catalog.noResults}</Text>
        ) : (
          <View className='catalog-sections'>
            {grouped.map(section => (
              <View className='catalog-section' key={section.letter} id={`catalog-section-${section.letter}`}>
                <Text className='catalog-section__title'>{section.letter}</Text>
                <View className='catalog-grid'>
                  {section.items.map(item => (
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
              </View>
            ))}
          </View>
        )}
        {hasMore && (
          <View className='pill-button catalog-load-more' onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
            <Text>{t.common.loadMore}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
