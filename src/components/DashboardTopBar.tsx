'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, LogOut, Menu, MoreVertical, RefreshCw, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLogout } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [hash, setHash] = useState('')

  useEffect(() => {
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

  return (
    <header className="mms-topbar">
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
          <Image
            src="/image/khandaq-logo.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-xl object-cover ring-1 ring-cyan-300/70"
          />
          <span className="min-w-0">
            {role !== 'admin' && <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">MMS1</span>}
            <span className="block text-sm font-semibold leading-tight text-white">Dashboard</span>
          </span>
        </Link>
        <div className="mms-top-actions">
          <div className="mms-alert-group" role="group" aria-label="Alerts">
            {alerts}
          </div>
          <div className="mms-top-action announcement">{announcement}</div>
          <button
            type="button"
            aria-label="Refresh dashboard"
            title="Refresh"
            onClick={() => window.location.reload()}
            className="mms-top-icon-button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={handleLogout}
            className="mms-top-icon-button"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={menuOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="mms-top-icon-button mms-overflow-trigger"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>
      {menuOpen && (
        <>
          <button
            type="button"
            className="mms-sidebar-backdrop"
            aria-label="Close dashboard menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav aria-label="Dashboard sections" className="mms-top-menu">
            {links.map(({ href, label, icon: Icon }) => {
              const [linkPath, linkHash] = href.split('#')
              const active = (pathname === linkPath && (linkHash ? hash === `#${linkHash}` : !hash))
                || (href !== '/admin' && href !== '/teacher' && href !== '/parent' && pathname.startsWith(`${linkPath}/`))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('mms-top-menu-link', active && 'is-active')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>
        </>
      )}
    </header>
  )
}
