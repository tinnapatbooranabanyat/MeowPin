import { PawPrint, Search, X } from 'lucide-react'
import { useState } from 'react'
import type { Cat } from '../types'
import { CatAvatar } from './CatAvatar'
import { useI18n } from '../hooks/useI18n'

interface Props {
  query: string
  onQueryChange: (query: string) => void
  suggestions: Cat[]
  onSelect: (cat: Cat) => void
}

export function SearchBar({ query, onQueryChange, suggestions, onSelect }: Props) {
  const { t } = useI18n()
  const [focused, setFocused] = useState(false)
  const showSuggestions = focused && query.trim().length > 0

  return (
    <div className="relative">
      <div className="flex h-12 items-center gap-3 rounded-full bg-surface px-4 shadow-md ring-1 ring-stone-200">
        <PawPrint className="shrink-0 text-orange-500" size={22} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions[0]) {
              onSelect(suggestions[0])
              e.currentTarget.blur()
            }
          }}
          placeholder={t('ค้นหาแมว หรือสถานที่')}
          aria-label={t('ค้นหาแมว หรือสถานที่')}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-stone-800 outline-none placeholder:text-stone-400"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="rounded-full p-1 text-stone-500 hover:bg-stone-100"
            aria-label={t('ล้างคำค้นหา')}
          >
            <X size={18} />
          </button>
        ) : (
          <Search className="shrink-0 text-stone-400" size={20} aria-hidden="true" />
        )}
      </div>

      {showSuggestions && (
        <ul className="absolute inset-x-0 top-14 max-h-80 overflow-auto rounded-2xl bg-surface py-2 shadow-lg ring-1 ring-stone-200">
          {suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-stone-500">{t('ไม่เจอแมวที่ตรงกับ “{q}”', { q: query })}</li>
          )}
          {suggestions.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                // กันไม่ให้ input blur ก่อนที่ click จะทำงาน
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(cat)
                  setFocused(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-orange-50"
              >
                <CatAvatar cat={cat} className="size-9 shrink-0 rounded-full" iconSize={18} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-stone-800">{cat.name}</span>
                  <span className="block truncate text-xs text-stone-500">{cat.placeName || t('ไม่ระบุสถานที่')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
