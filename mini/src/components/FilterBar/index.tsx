import { View, Text, Input, Picker } from '@tarojs/components'
import './index.scss'

interface Props {
  keywordLabel: string
  keywordPlaceholder: string
  categoryLabel: string
  categories: string[]
  selectedCategory: string
  keyword: string
  allCategoriesLabel: string
  onKeywordChange: (value: string) => void
  onCategoryChange: (value: string) => void
}

export function FilterBar({
  keywordLabel, keywordPlaceholder, categoryLabel, categories,
  selectedCategory, keyword, allCategoriesLabel,
  onKeywordChange, onCategoryChange
}: Props) {
  const pickerRange = [allCategoriesLabel, ...categories]
  const pickerIndex = selectedCategory
    ? categories.indexOf(selectedCategory) + 1
    : 0

  return (
    <View className='filter-bar'>
      <View className='filter-bar__group'>
        <Text className='filter-bar__label'>{keywordLabel}</Text>
        <Input
          className='filter-bar__input'
          type='text'
          placeholder={keywordPlaceholder}
          value={keyword}
          onInput={e => onKeywordChange(e.detail.value)}
        />
      </View>
      <View className='filter-bar__group'>
        <Text className='filter-bar__label'>{categoryLabel}</Text>
        <Picker
          mode='selector'
          range={pickerRange}
          value={pickerIndex}
          onChange={e => {
            const idx = Number(e.detail.value)
            onCategoryChange(idx === 0 ? '' : categories[idx - 1])
          }}
        >
          <View className='filter-bar__picker'>
            <Text>{selectedCategory || allCategoriesLabel}</Text>
          </View>
        </Picker>
      </View>
    </View>
  )
}
