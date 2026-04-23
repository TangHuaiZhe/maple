import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import type { CatalogItem } from '../../types/catalog'
import { fetchAwards, getCachedAwards } from '../../services/catalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

export default function AwardsPage() {
  const [items, setItems] = useState<CatalogItem[]>(() => getCachedAwards() || [])
  const [loading, setLoading] = useState(!getCachedAwards())
  const [error, setError] = useState<string | null>(null)
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  const t = UI_STRINGS[locale]

  useEffect(() => {
    let mounted = true
    fetchAwards()
      .then(data => {
        if (!mounted) return
        setItems(data)
        setLoading(false)
      })
      .catch(err => {
        if (!mounted) return
        setError(err?.message || 'Unknown error')
        setLoading(false)
      })
    return () => { mounted = false }
  }, [])

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
            <Text className='page-title'>{t.awards.title}</Text>
            <Text className='page-subtitle'>{t.awards.subtitle}</Text>
          </View>
          <LocaleSwitch />
        </View>
        <Text className='meta-chip' style={{ marginTop: '16rpx' }}>
          {t.awards.count.replace('{count}', String(items.length))}
        </Text>
      </View>

      <View className='awards-grid'>
        {items.map(item => (
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
  )
}
