import { View, Text } from '@tarojs/components'
import { useLocale } from '../../hooks/useLocale'
import './index.scss'

export function LocaleSwitch() {
  const { locale, toggleLocale } = useLocale()

  return (
    <View className='locale-switch' onClick={toggleLocale}>
      <Text className={`locale-switch__item ${locale === 'zh' ? 'is-active' : ''}`}>中</Text>
      <Text className='locale-switch__divider'>/</Text>
      <Text className={`locale-switch__item ${locale === 'en' ? 'is-active' : ''}`}>EN</Text>
    </View>
  )
}
