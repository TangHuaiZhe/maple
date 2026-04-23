import { View, Text } from '@tarojs/components'
import type { InfoRow } from '../../utils/fields'
import './index.scss'

interface Props {
  title: string
  rows: InfoRow[]
}

export function InfoSection({ title, rows }: Props) {
  if (!rows.length) return null

  return (
    <View className='info-section section-card'>
      <Text className='section-title'>{title}</Text>
      {rows.map(row => (
        <View key={row.label} className='info-section__row'>
          <Text className='info-section__label'>{row.label}</Text>
          <Text className='info-section__value'>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}
