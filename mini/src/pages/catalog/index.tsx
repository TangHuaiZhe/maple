import { useState, useMemo, useCallback } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useShareAppMessage, usePullDownRefresh, stopPullDownRefresh } from '@tarojs/taro'
import { useCatalog } from '../../hooks/useCatalog'
import { useFavorites } from '../../hooks/useFavorites'
import { useLocale } from '../../hooks/useLocale'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { CultivarCard } from '../../components/CultivarCard'
import { LocaleSwitch } from '../../components/LocaleSwitch'
import { filterDiscoveryItems } from '../../utils/discovery'
import { matchesCatalogKeyword } from '../../utils/text'
import { UI_STRINGS } from '../../utils/locale'
import './index.scss'

const LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
const PREVIEW_PER_LETTER = 6
function getLatinSortLabel(item: { display_name?: string; canonical_name?: string; scientific_name?: string }) {
  const candidates = [item.display_name, item.canonical_name, item.scientific_name]
  for (const candidate of candidates) {
    if (!candidate) continue
    if (/[A-Za-z]/.test(candidate)) return candidate
  }
  return candidates.find(Boolean) || ''
}

function getAlphaGroup(item: { display_name?: string; canonical_name?: string; scientific_name?: string }) {
  const label = getLatinSortLabel(item)
  const match = label.match(/[A-Za-z]/)
  return match ? match[0].toUpperCase() : '#'
}

export default function CatalogPage() {
  const { items, loading, error } = useCatalog()
  const { locale } = useLocale()
  const { isFavorite, toggleFavorite } = useFavorites()

  useShareAppMessage(() => ({
    title: '日本枫树 - 品种目录',
    path: '/pages/catalog/index'
  }))
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword)
  const [scrollIntoId, setScrollIntoId] = useState('')
  const [activeLetter, setActiveLetter] = useState('')
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set())

  const t = UI_STRINGS[locale]

  const sorted = useMemo(() => {
    const visibleItems = filterDiscoveryItems(items, false)
    return visibleItems
      .slice()
      .sort((left, right) => getLatinSortLabel(left).localeCompare(getLatinSortLabel(right), 'en', { sensitivity: 'base', numeric: true }))
  }, [items])

  const filtered = useMemo(() => (
    debouncedKeyword
      ? sorted.filter(item => matchesCatalogKeyword(item, debouncedKeyword))
      : sorted
  ), [sorted, debouncedKeyword])

  // Group all filtered items by letter
  const allGrouped = useMemo(() => {
    const sections = new Map<string, typeof filtered>()
    for (const item of filtered) {
      const group = getAlphaGroup(item)
      const current = sections.get(group) || []
      current.push(item)
      sections.set(group, current)
    }
    return [...LETTERS, '#']
      .map(letter => ({ letter, items: sections.get(letter) || [] }))
      .filter(section => section.items.length > 0)
  }, [filtered])

  // Show preview (PREVIEW_PER_LETTER) for collapsed letters, full for expanded
  const grouped = useMemo(() => {
    return allGrouped.map(section => ({
      letter: section.letter,
      items: expandedLetters.has(section.letter) ? section.items : section.items.slice(0, PREVIEW_PER_LETTER),
      total: section.items.length,
      expanded: expandedLetters.has(section.letter)
    }))
  }, [allGrouped, expandedLetters])

  const visibleTotal = grouped.reduce((sum, s) => sum + s.items.length, 0)

  // All available letters from full dataset (not just visible/paged items)
  const availableLetters = useMemo(() => {
    const letterSet = new Set<string>()
    for (const item of filtered) {
      letterSet.add(getAlphaGroup(item))
    }
    return [...LETTERS, '#'].filter(l => letterSet.has(l))
  }, [filtered])

  const handleLetterTap = useCallback((letter: string) => {
    setExpandedLetters(prev => {
      const next = new Set(prev)
      next.add(letter)
      return next
    })
    setTimeout(() => {
      setScrollIntoId(`catalog-section-${letter === '#' ? 'hash' : letter}`)
    }, 50)
    setActiveLetter(letter)
    setTimeout(() => setActiveLetter(''), 800)
  }, [])

  const handleRefresh = useCallback(() => {
    setKeyword('')
    setExpandedLetters(new Set())
    stopPullDownRefresh()
  }, [])

  usePullDownRefresh(handleRefresh)

  if (loading && !items.length) {
    return <View className='page-shell'><Text className='status-text'>{t.common.loading}</Text></View>
  }

  if (error) {
    return <View className='page-shell'><Text className='status-text'>{t.common.error}</Text></View>
  }

  return (
    <View className='page-shell catalog-page'>
      <View className='page-header'>
        <View className='header-row'>
          <View />
          <LocaleSwitch />
        </View>
      </View>

      <View className='catalog-search'>
        <Input
          className='catalog-search__input'
          type='text'
          placeholder={t.catalog.searchPlaceholder}
          value={keyword}
          onInput={e => { setKeyword(e.detail.value); setExpandedLetters(new Set()) }}
        />
      </View>

      <View className='catalog-body'>
        <ScrollView className='catalog-alpha-bar' scrollY enhanced showScrollbar={false}>
          {availableLetters.map(letter => (
            <Text
              key={letter}
              className={`catalog-alpha-bar__letter${activeLetter === letter ? ' catalog-alpha-bar__letter--active' : ''}`}
              onClick={() => handleLetterTap(letter)}
            >
              {letter}
            </Text>
          ))}
        </ScrollView>

        <ScrollView
          className='catalog-scroll'
          scrollY
          enhanced
          showScrollbar={false}
          scrollIntoView={scrollIntoId}
          scrollWithAnimation
        >
          {filtered.length === 0 ? (
            <Text className='status-text'>{t.catalog.noResults}</Text>
          ) : (
            <View className='catalog-sections'>
              {grouped.map(section => (
                <View className='catalog-section' key={section.letter} id={`catalog-section-${section.letter === '#' ? 'hash' : section.letter}`}>
                  <Text className='catalog-section__title'>{section.letter}</Text>
                  <View className='catalog-grid'>
                    {section.items.map(item => (
                      <CultivarCard
                        key={item.id}
                        item={item}
                        locale={locale}
                        noImageLabel={t.common.noImage}
                        isFavorite={isFavorite(item.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </View>
                  {!section.expanded && section.total > PREVIEW_PER_LETTER && (
                    <Text
                      className='catalog-section__more'
                      onClick={() => setExpandedLetters(prev => { const next = new Set(prev); next.add(section.letter); return next })}
                    >
                      {t.common.loadMore} ({section.total - PREVIEW_PER_LETTER})
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}
