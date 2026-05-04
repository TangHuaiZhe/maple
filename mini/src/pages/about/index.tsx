import { View, Text } from '@tarojs/components'
import { BUILD_INFO } from '../../buildInfo'
import { FeedbackEntry } from '../../components/FeedbackEntry'
import { useLocale } from '../../hooks/useLocale'
import './index.scss'

function formatDate(value: string, locale: 'zh' | 'en'): string {
  if (!value || value === 'unknown') return locale === 'zh' ? '未知' : 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function AboutPage() {
  const { locale } = useLocale()
  const unknown = locale === 'zh' ? '未知' : 'Unknown'
  const title = locale === 'zh' ? '版本信息' : 'Version Info'
  const subtitle = locale === 'zh'
    ? '用于确认当前小程序构建对应的代码版本'
    : 'Use this to identify the code version behind this build'

  const rows = [
    [locale === 'zh' ? '应用版本' : 'App version', BUILD_INFO.version],
    [locale === 'zh' ? 'Git Commit' : 'Git commit', BUILD_INFO.commit],
    [locale === 'zh' ? '完整 Commit' : 'Full commit', BUILD_INFO.commitFull],
    [locale === 'zh' ? '提交时间' : 'Commit date', formatDate(BUILD_INFO.commitDate, locale)],
    [locale === 'zh' ? '提交说明' : 'Commit subject', BUILD_INFO.commitSubject || unknown],
    [locale === 'zh' ? '构建时间' : 'Build time', formatDate(BUILD_INFO.buildTime, locale)]
  ]

  return (
    <View className='page-shell'>
      <View className='page-header'>
        <Text className='page-title'>{title}</Text>
        <Text className='page-subtitle'>{subtitle}</Text>
      </View>

      <View className='section-card about-card'>
        {rows.map(([label, value]) => (
          <View className='about-row' key={label}>
            <Text className='about-row__label'>{label}</Text>
            <Text className='about-row__value'>{value === 'unknown' ? unknown : value}</Text>
          </View>
        ))}
      </View>

      <View className='section-card about-feedback'>
        <Text className='about-feedback__hint'>
          {locale === 'zh' ? '有建议或问题？欢迎直接提交反馈。' : 'Have suggestions or issues? Send us feedback directly.'}
        </Text>
        <FeedbackEntry />
      </View>
    </View>
  )
}
