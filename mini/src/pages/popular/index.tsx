import { View, Text } from '@tarojs/components'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { UI_STRINGS } from '../../utils/locale'
import POPULAR_IDS from './popular-ids.json'
import './index.scss'

export default function PopularPage() {
  const { items, loading, error } = useCatalog()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  const t = UI_STRINGS[locale]

  const popularItems = POPULAR_IDS
    .map(id => items.find(item => item.id === id))
    .filter(Boolean)

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
