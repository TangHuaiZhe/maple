import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { fetchPopularIds, getCachedPopularIds } from '../../services/catalog'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

export default function PopularPage() {
  const { items, loading: catalogLoading } = useCatalog()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [popularIds, setPopularIds] = useState<string[]>(() => getCachedPopularIds() || [])
  const [loading, setLoading] = useState(!getCachedPopularIds())

  const t = UI_STRINGS[locale]

  useEffect(() => {
    let mounted = true
    fetchPopularIds()
      .then(ids => { if (mounted) { setPopularIds(ids); setLoading(false) } })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const popularItems = popularIds
    .map(id => items.find(item => item.id === id))
    .filter(Boolean)

  if ((loading || catalogLoading) && !popularItems.length) {
    return <View className='page-shell'><Text className='status-text'>{t.common.loading}</Text></View>
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
        <Text className='meta-chip' style={{ marginTop: '16rpx' }}>
          {popularItems.length}{t.common.items}
        </Text>
      </View>

      <View className='popular-grid'>
        {popularItems.map(item => (
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
    </View>
  )
}
