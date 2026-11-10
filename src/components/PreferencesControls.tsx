'use client'

import { Moon, Sun } from 'lucide-react'
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

  return (
    <div className={cn('mms-preference-controls', className)}>
      <label className="sr-only" htmlFor="app-language">{t('Choose language')}</label>
      <select
        id="app-language"
        aria-label={t('Choose language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as AppLanguage)}
        className="mms-language-select"
      >
        {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
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
