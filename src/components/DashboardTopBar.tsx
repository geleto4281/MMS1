'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, MoreVertical, RefreshCw, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLogout } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/context/PreferencesContext'
import { PreferencesControls } from '@/components/PreferencesControls'

type DashboardLink = {
  href: string
  label: string
  icon: LucideIcon
}

export function DashboardTopBar({
  role,
  links,
  alerts,
  announcement,
}: {
  role: string
  links: DashboardLink[]
  alerts: React.ReactNode
  announcement: React.ReactNode
}) {
  const pathname = usePathname()
  const logout = useLogout()
  const { t } = usePreferences()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hash, setHash] = useState('')
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
    const updateHash = () => setHash(window.location.hash)
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const isLinkActive = (href: string) => {
    const [linkPath, linkHash] = href.split('#')
    return (pathname === linkPath && (linkHash ? hash === `#${linkHash}` : !hash))
      || (href !== '/admin' && href !== '/teacher' && href !== '/parent' && pathname.startsWith(`${linkPath}/`))
  }

  const renderLinks = (className: string) => links.map(({ href, label, icon: Icon }) => {
    const active = isLinkActive(href)
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMenuOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(className, active && 'is-active')}
      >
        <Icon className="h-4 w-4" />
        <span>{t(label)}</span>
      </Link>
    )
  })

  return (
    <>
    <header className={cn('mms-topbar', role === 'admin' && 'mms-topbar-admin')}>
      <div className="mms-topbar-row">
        <button
          type="button"
          aria-label={menuOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="mms-top-icon-button mms-menu-trigger"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link href={role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/parent'} className="mms-top-brand">
          <span className="mms-logo-badge mms-logo-badge-small">
            <Image
              src="/image/mms1-logo.png"
              alt="MMS logo"
              width={38}
              height={38}
              className="h-full w-full object-contain"
            />
          </span>
          <span className="min-w-0">
            {role !== 'admin' && <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">MMS1</span>}
            <span className="mms-top-brand-label block text-sm font-semibold leading-tight text-white">{t('Dashboard')}</span>
          </span>
        </Link>
        <div className="mms-top-actions">
          <div className="mms-alert-group" role="group" aria-label="Alerts">
            {alerts}
          </div>
          <div className="mms-top-action announcement">{announcement}</div>
          <PreferencesControls />
          <button
            type="button"
            aria-label={t('Refresh dashboard')}
            title={t('Refresh dashboard')}
            onClick={() => window.location.reload()}
            className="mms-top-icon-button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t('Sign out')}
            title={t('Sign out')}
            onClick={handleLogout}
            className="mms-top-icon-button"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={menuOpen ? t('Close dashboard menu') : t('Open dashboard menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="mms-top-icon-button mms-overflow-trigger"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
      {role === 'admin' && portalReady && createPortal(
        <nav aria-label={t('Admin navigation')} className="mms-admin-desktop-nav">
          {renderLinks('mms-admin-desktop-link')}
        </nav>,
        document.body
      )}
      {menuOpen && portalReady && createPortal(
        <div className="mms-menu-layer">
          <button
            type="button"
            className="mms-sidebar-backdrop"
            aria-label={t('Close dashboard menu')}
            onClick={() => setMenuOpen(false)}
          />
          <nav aria-label="Dashboard sections" className="mms-top-menu">
            {renderLinks('mms-top-menu-link')}
          </nav>
        </div>,
        document.body
      )}
    </>
  )
}
