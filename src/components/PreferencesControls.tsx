'use client'

import { Languages, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePreferences, type AppLanguage } from '@/context/PreferencesContext'
import { cn } from '@/lib/utils'

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'om', label: 'Afaan Oromoo' },
  { value: 'am', label: 'አማርኛ' },
  { value: 'so', label: 'Soomaali' },
]

export function PreferencesControls({ className }: { className?: string }) {
  const { language, theme, setLanguage, toggleTheme, t } = usePreferences()
  const themeLabel = theme === 'dark' ? t('Light mode') : t('Dark mode')
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!languageMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [languageMenuOpen])

  return (
    <div className={cn('mms-preference-controls', className)}>
      <div className="mms-language-control" ref={languageMenuRef}>
        <button
          type="button"
          aria-label={t('Choose language')}
          aria-expanded={languageMenuOpen}
          aria-haspopup="menu"
          title={t('Choose language')}
          onClick={() => setLanguageMenuOpen((open) => !open)}
          className="mms-preference-theme mms-language-trigger"
        >
          <Languages className="h-4 w-4" />
        </button>
        {languageMenuOpen && (
          <div className="mms-language-menu" role="menu" aria-label={t('Choose language')}>
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={language === option.value}
                onClick={() => {
                  setLanguage(option.value)
                  setLanguageMenuOpen(false)
                }}
                className="mms-language-menu-item"
              >
                <span>{option.label}</span>
                {language === option.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={themeLabel}
        title={themeLabel}
        className="mms-preference-theme"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  )
}
