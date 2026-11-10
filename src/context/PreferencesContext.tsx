'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from '@/lib/translations'

export type AppLanguage = 'en' | 'om' | 'am' | 'so'
export type AppTheme = 'dark' | 'light'

interface PreferencesContextValue {
  language: AppLanguage
  theme: AppTheme
  setLanguage: (language: AppLanguage) => void
  toggleTheme: () => void
  t: (phrase: string) => string
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

const LANGUAGE_STORAGE_KEY = 'mms1-language'
const THEME_STORAGE_KEY = 'mms1-theme'

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en')
  const [theme, setThemeState] = useState<AppTheme>('dark')
  const [preferencesReady, setPreferencesReady] = useState(false)

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (storedLanguage === 'om' || storedLanguage === 'am' || storedLanguage === 'so') {
      setLanguageState(storedLanguage)
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') setThemeState(storedTheme)
    setPreferencesReady(true)
  }, [])

  useEffect(() => {
    if (!preferencesReady) return
    document.documentElement.lang = language === 'om' ? 'om' : language
    document.documentElement.dataset.theme = theme
    document.body.dataset.theme = theme
    document.documentElement.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [language, theme, preferencesReady])

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => current === 'dark' ? 'light' : 'dark')
  }, [])

  const t = useCallback((phrase: string) => {
    if (language === 'en') return phrase
    return translations[language][phrase] || phrase
  }, [language])

  const value = useMemo(() => ({ language, theme, setLanguage, toggleTheme, t }), [language, theme, setLanguage, toggleTheme, t])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider')
  return context
}
