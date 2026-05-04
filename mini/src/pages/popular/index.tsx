import { useState } from 'react'
import { View, Text, Input, Switch } from '@tarojs/components'
import { useShareAppMessage } from '@tarojs/taro'
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
import POPULAR_IDS from './popular-ids.json'
import './index.scss'

export default function PopularPage() {
  const { items, loading, error } = useCatalog()
  const { showDiscoveryCultivars, setShowDiscoveryCultivars } = useDiscoveryVisibility()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  useShareAppMessage(() => ({
    title: '日本枫树 - 流行品种',
    path: '/pages/popular/index'
  }))

  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword)

  const t = UI_STRINGS[locale]
  const visibleItems = filterDiscoveryItems(items, showDiscoveryCultivars)
  const visibleRecordMap = new Map(visibleItems.map(item => [item.id, item]))

  const popularItems = POPULAR_IDS
    .map(id => visibleRecordMap.get(id))
    .filter(Boolean)

  const filtered = debouncedKeyword
    ? visibleItems.filter(item => matchesCatalogKeyword(item, debouncedKeyword))
    : popularItems

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
            <Text className='page-title'>{locale === 'zh' ? '流行品种' : 'Popular Cultivars'}</Text>
            <Text className='page-subtitle'>
              {locale === 'zh'
                ? '最受欢迎和广泛种植的日本枫树品种'
                : 'Most popular and widely cultivated Japanese maples'}
            </Text>
          </View>
          <LocaleSwitch />
        </View>
        <View className='catalog-search'>
          <Input
            className='catalog-search__input'
            type='text'
            placeholder={t.catalog.searchPlaceholder}
            value={keyword}
            onInput={e => setKeyword(e.detail.value)}
          />
        </View>
        <View className='discovery-toggle'>
          <Text className='discovery-toggle__label'>{t.common.discoveryToggle}</Text>
          <Switch
            checked={showDiscoveryCultivars}
            color='#983726'
            onChange={e => setShowDiscoveryCultivars(e.detail.value)}
          />
        </View>
        <Text className='meta-chip' style={{ marginTop: '16rpx' }}>
          {filtered.length}{t.common.items}
        </Text>
      </View>

      {filtered.length === 0 ? (
        <Text className='status-text'>{t.catalog.noResults}</Text>
      ) : (
        <View className='popular-grid'>
          {filtered.map(item => (
            <CultivarCard
              key={item!.id}
              item={item!}
              locale={locale}
              noImageLabel={t.common.noImage}
              isFavorite={isFavorite(item!.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </View>
      )}
    </View>
  )
}
