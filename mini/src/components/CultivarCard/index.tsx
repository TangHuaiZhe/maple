import { Image, View, Text, Navigator } from '@tarojs/components'
import type { CatalogItem, Locale, ThumbnailManifest } from '../../types/catalog'
import { getCardCover } from '../../utils/image'
import { getPrimaryName, getSecondaryName } from '../../utils/locale'
import './index.scss'

interface Props {
  item: CatalogItem
  locale: Locale
  noImageLabel: string
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  thumbnailManifest?: ThumbnailManifest
}

export function CultivarCard({ item, locale, noImageLabel, isFavorite, onToggleFavorite, thumbnailManifest = {} }: Props) {
  const cover = getCardCover(item, thumbnailManifest)
  const primary = getPrimaryName(locale, item.display_name, item.chinese_name)
  const secondary = getSecondaryName(locale, item.display_name, item.chinese_name)

  return (
    <Navigator url={`/pages/cultivar-detail/index?id=${item.id}`} className='card'>
      <View className='card__media'>
        {cover ? (
          <Image className='card__image' src={cover} mode='aspectFill' lazyLoad />
        ) : (
          <View className='card__placeholder'>
            <Text>{noImageLabel}</Text>
          </View>
        )}
        <View
          className={`card__favorite ${isFavorite ? 'is-active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(item.id) }}
        >
          <Text>{isFavorite ? '♥' : '♡'}</Text>
        </View>
      </View>
      <View className='card__body'>
        <Text className='card__title'>{primary}</Text>
        {secondary ? <Text className='card__subtitle'>{secondary}</Text> : null}
        <View className='card__tags'>
          {item.top_category && <Text className='card__tag'>{item.top_category}</Text>}
          {item.web_group && <Text className='card__tag'>{item.web_group}</Text>}
        </View>
      </View>
    </Navigator>
  )
}
