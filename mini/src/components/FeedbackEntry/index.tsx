import { Button, Text } from '@tarojs/components'
import { useLocale } from '../../hooks/useLocale'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

interface FeedbackEntryProps {
  compact?: boolean
}

export function FeedbackEntry({ compact = false }: FeedbackEntryProps) {
  const { locale } = useLocale()
  const t = UI_STRINGS[locale]

  return (
    <Button
      className={`feedback-entry ${compact ? 'is-compact' : ''}`}
      openType='feedback'
    >
      <Text>{t.common.feedback}</Text>
    </Button>
  )
}
