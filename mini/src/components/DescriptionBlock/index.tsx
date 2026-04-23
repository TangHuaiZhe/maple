import { View, Text } from '@tarojs/components'
import './index.scss'

interface Props {
  summaryLabel: string
  fullLabel: string
  emptyLabel: string
  summary?: string | null
  full?: string | null
}

function normalize(text?: string | null): string {
  return (text || '').trim()
}

export function DescriptionBlock({ summaryLabel, fullLabel, emptyLabel, summary, full }: Props) {
  const s = normalize(summary)
  const f = normalize(full)

  if (!s && !f) {
    return (
      <View className='desc-block section-card'>
        <Text className='status-text'>{emptyLabel}</Text>
      </View>
    )
  }

  const display = f.length >= s.length ? f : s
  const label = f.length >= s.length ? fullLabel : summaryLabel

  return (
    <View className='desc-block section-card'>
      <Text className='desc-block__label'>{label}</Text>
      <Text className='desc-block__text'>{display}</Text>
    </View>
  )
}
