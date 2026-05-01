import { View, Text } from '@tarojs/components'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

export default function FavoritesPage() {
  const { items } = useCatalog()
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const { locale } = useLocale()

  const t = UI_STRINGS[locale]

  const favoriteItems = favoriteIds
    .map(id => items.find(item => item.id === id))
    .filter(Boolean)

  return (
    <View className='page-shell'>
      <View className='page-header'>
        <View className='header-row'>
          <View>
            <Text className='page-title'>{t.favorites.title}</Text>
            <Text className='page-subtitle'>{t.favorites.subtitle}</Text>
          </View>
          <LocaleSwitch />
        </View>
        {favoriteItems.length > 0 && (
          <Text className='meta-chip' style={{ marginTop: '16rpx' }}>
            {t.favorites.count.replace('{count}', String(favoriteItems.length))}
          </Text>
        )}
      </View>

      {favoriteItems.length === 0 ? (
        <View className='favorites-empty'>
          <Text className='favorites-empty__title'>{t.favorites.empty}</Text>
          <Text className='favorites-empty__hint'>{t.favorites.emptyHint}</Text>
        </View>
      ) : (
        <View className='favorites-grid'>
          {favoriteItems.map(item => (
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
