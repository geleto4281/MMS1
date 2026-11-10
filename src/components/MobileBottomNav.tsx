'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { usePreferences } from '@/context/PreferencesContext'

type MobileNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export function MobileBottomNav({ items }: { items: MobileNavItem[] }) {
  const pathname = usePathname()
  const { t } = usePreferences()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash)
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  return (
    <nav aria-label="Main navigation" className="mms-mobile-nav lg:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const [route, anchor] = href.split('#')
        const isActive = anchor
          ? pathname === route && hash === `#${anchor}`
          : pathname === href || (href !== '/admin' && href !== '/teacher' && pathname.startsWith(`${href}/`))

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`mms-mobile-nav-item${isActive ? ' is-active' : ''}`}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span>{t(label)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
