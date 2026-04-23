import { useState, useEffect } from 'react'
import { Image, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

const PAGE_SIZE = 10

interface Props {
  title: string
  images: string[]
  loadMoreLabel: string
  noImageLabel: string
}

export function GalleryGrid({ title, images, loadMoreLabel, noImageLabel }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [images])

  if (!images.length) {
    return (
      <View className='section-card'>
        <Text className='section-title'>{title}</Text>
        <Text className='status-text'>{noImageLabel}</Text>
      </View>
    )
  }

  const visible = images.slice(0, visibleCount)
  const hasMore = visibleCount < images.length

  return (
    <View className='section-card'>
      <Text className='section-title'>{title}</Text>
      <View className='gallery-grid'>
        {visible.map((src, i) => (
          <Image
            key={i}
            className='gallery-grid__image'
            src={src}
            mode='aspectFill'
            lazyLoad
            onClick={() => {
              Taro.previewImage({ current: src, urls: images })
            }}
          />
        ))}
      </View>
      {hasMore && (
        <View
          className='pill-button'
          onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
        >
          <Text>{loadMoreLabel}</Text>
        </View>
      )}
    </View>
  )
}
