import { View, Text } from '@tarojs/components'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

const POPULAR_IDS = [
  'acer-palmatum-bloodgood',
  'acer-palmatum-osakazuk',
  'acer-palmatum-crimson-queen',
  'acer-palmatum-emerald-lace',
  'acer-palmatum-garnet',
  'acer-palmatum-inaba-shidare',
  'acer-palmatum-orangeola',
  'acer-palmatum-ornatum',
  'acer-palmatum-seiryu',
  'acer-palmatum-kiyohime',
  'acer-palmatum-kinshi',
  'acer-palmatum-red-pygmy',
  'acer-palmatum-burgundy-lace',
  'acer-palmatum-chitose-yama',
  'acer-palmatum-elegans',
  'acer-palmatum-trompenburg',
  'acer-palmatum-ariadne',
  'acer-palmatum-beni-maiko',
  'acer-palmatum-corallinum',
  'acer-palmatum-eddisbury',
  'acer-palmatum-katsura',
  'acer-palmatum-orange-dream',
  'acer-palmatum-sango-kaku',
  'acer-palmatum-shin-desho-jo',
  'acer-palmatum-shishigashira',
  'acer-palmatum-beni-tsukasa',
  'acer-japonicum-aconitifolium',
  'acer-japonicum-green-cascade',
  'acer-japonicum-vitifolium',
  'acer-palmatum-akane',
  'acer-palmatum-aka-shigitatsu-sawa',
  'acer-palmatum-coral-pink',
  'acer-palmatum-peaches-and-cream',
  'acer-palmatum-seigai',
  'acer-palmatum-ueno-yama',
  'acer-cappadocicum-aureum',
  'acer-palmatum-golden-pond',
  'acer-circinatum-herbstfeuer',
  'acer-palmatum-ho-gyoku',
  'acer-palmatum-ichigyo-ji',
  'acer-shirasawanum-juhni-hitoe',
  'acer-palmatum-tana',
  'acer-palmatum-aoyagi',
  'acer-palmatum-arakawa',
  'acer-palmatum-beni-kawa',
  'acer-palmatum-fjellheim',
  'acer-palmatum-ibo-nishiki',
  'acer-palmatum-japanese-sunrise',
  'acer-palmatum-kogane-sakae',
  'acer-palmatum-nishiki-gawa',
  'acer-palmatum-winter-flame',
]

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
