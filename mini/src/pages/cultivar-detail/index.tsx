import { Image, View, Text } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useCultivarDetail } from '../../hooks/useCultivarDetail'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { InfoSection } from '../../components/InfoSection'
import { DescriptionBlock } from '../../components/DescriptionBlock'
import { GalleryGrid } from '../../components/GalleryGrid'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { getLocalizedDetail, getPrimaryName, getSecondaryName, UI_STRINGS } from '../../utils/locale'
import { getCardCover, getGalleryImages } from '../../utils/image'
import { buildSummary } from '../../utils/text'
import { buildBasicInfoRows, buildRhsInfoRows } from '../../utils/fields'
import './index.scss'

export default function CultivarDetailPage() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const id = currentPage?.options?.id as string | undefined

  const { detail, loading, error } = useCultivarDetail(id)
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  const t = UI_STRINGS[locale]

  useShareAppMessage(() => {
    const title = detail ? getPrimaryName(detail, locale) : '日本枫树品种详情'
    return {
      title,
      path: `/pages/cultivar-detail/index?id=${id}`
    }
  })

  if (loading) {
    return <View className='page-shell'><Text className='status-text'>{t.common.loading}</Text></View>
  }

  if (error || !detail) {
    return <View className='page-shell'><Text className='status-text'>{t.common.error}</Text></View>
  }

  const localized = getLocalizedDetail(detail, locale)
  const primary = getPrimaryName(locale, detail.display_name, detail.chinese_name)
  const secondary = getSecondaryName(locale, detail.display_name, detail.chinese_name)
  const cover = getCardCover(detail)
  const images = getGalleryImages(detail)
  const basicRows = buildBasicInfoRows(localized, t.detail)
  const rhsRows = buildRhsInfoRows(localized, t.detail)
  const summary = buildSummary(localized.preferred_description)
  const full = localized.descriptions?.preferred || localized.rhs?.description || ''

  Taro.setNavigationBarTitle({ title: primary })

  return (
    <View className='page-shell'>
      <View className='detail-page__hero'>
        {cover && <Image className='detail-page__hero-image' src={cover} mode='aspectFill' />}
        <View className='detail-page__hero-info'>
          <View className='header-row'>
            <View style={{ flex: 1 }}>
              <Text className='page-title'>{primary}</Text>
              {secondary ? <Text className='page-subtitle'>{secondary}</Text> : null}
            </View>
            <LocaleSwitch />
          </View>
          <View
            className={`ghost-button detail-page__favorite-button ${isFavorite(detail.id) ? 'is-active' : ''}`}
            onClick={() => toggleFavorite(detail.id)}
          >
            <Text>{isFavorite(detail.id) ? '♥ 已收藏' : '♡ 收藏'}</Text>
          </View>
        </View>
      </View>

      <View className='detail-page__stack'>
        <InfoSection title={t.detail.basicInfo} rows={basicRows} />

        <GalleryGrid
          title={t.detail.gallery}
          images={images}
          loadMoreLabel={t.common.loadMore}
          noImageLabel={t.common.noImage}
        />

        <DescriptionBlock
          summaryLabel={t.detail.summaryLabel}
          fullLabel={t.detail.fullLabel}
          emptyLabel={t.detail.emptyDesc}
          summary={summary}
          full={full}
        />

        {rhsRows.length > 0 && (
          <InfoSection title={t.detail.rhsInfo} rows={rhsRows} />
        )}
      </View>
    </View>
  )
}
