import { useState, useMemo, useCallback } from 'react'
import { View, Text, Input, Switch } from '@tarojs/components'
import { useShareAppMessage, usePullDownRefresh, stopPullDownRefresh } from '@tarojs/taro'
import { useCatalog } from '../../hooks/useCatalog'
import { useDiscoveryVisibility } from '../../hooks/useDiscoveryVisibility'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { filterDiscoveryItems } from '../../utils/discovery'
import { matchesCatalogKeyword } from '../../utils/text'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

const PAGE_SIZE = 20

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function CatalogPage() {
  const { items, loading, error } = useCatalog()
  const { showDiscoveryCultivars, setShowDiscoveryCultivars } = useDiscoveryVisibility()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  useShareAppMessage(() => ({
    title: '日本枫树 - 品种目录',
    path: '/pages/catalog/index'
  }))
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [seed, setSeed] = useState(0)

  const t = UI_STRINGS[locale]

  const shuffled = useMemo(() => {
    void seed // dependency to trigger re-shuffle
    const visibleItems = filterDiscoveryItems(items, showDiscoveryCultivars)
    const withImage = visibleItems.filter(i => i.image_count > 0)
    const noImage = visibleItems.filter(i => !i.image_count)
    return [...shuffle(withImage), ...shuffle(noImage)]
  }, [items, seed, showDiscoveryCultivars])

  const filtered = debouncedKeyword
    ? shuffled.filter(item => matchesCatalogKeyword(item, debouncedKeyword))
    : shuffled
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleRefresh = useCallback(() => {
    setSeed(s => s + 1)
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
    <View className='page-shell'>
      <View className='page-header'>
        <View className='header-row'>
          <View>
            <Text className='page-eyebrow'>{t.catalog.eyebrow}</Text>
            <Text className='page-title'>{t.catalog.title}</Text>
          </View>
          <LocaleSwitch />
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
        <View className='discovery-toggle'>
          <Text className='discovery-toggle__label'>{t.common.discoveryToggle}</Text>
          <Switch
            checked={showDiscoveryCultivars}
            color='#983726'
            onChange={e => {
              setShowDiscoveryCultivars(e.detail.value)
              setVisibleCount(PAGE_SIZE)
            }}
          />
        </View>
      </View>

      {filtered.length === 0 ? (
        <Text className='status-text'>{t.catalog.noResults}</Text>
      ) : (
        <View className='catalog-grid'>
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
