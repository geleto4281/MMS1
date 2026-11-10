'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { UserRole } from '@/types'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  BarChart3,
  LogOut,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/useAuth'

interface DashboardNavProps {
  userRole: UserRole
}

export function DashboardNav({ userRole }: DashboardNavProps) {
  const pathname = usePathname()
  const logout = useLogout()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const adminLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/teachers', label: 'Users', icon: Users },
    { href: '/admin/classes', label: 'Classes', icon: GraduationCap },
    { href: '/admin/students', label: 'Students', icon: GraduationCap },
    { href: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  const teacherLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/teacher/classes', label: 'My Classes', icon: GraduationCap },
    { href: '/teacher/attendance', label: 'Take Attendance', icon: ClipboardList },
    { href: '/teacher/history', label: 'History', icon: BarChart3 },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  const links = userRole === 'admin' ? adminLinks : teacherLinks

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#080d16]/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link href="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
            <span className="mms-logo-badge mms-logo-badge-small"><Image src="/image/mms1-logo.png" alt="MMS logo" width={36} height={36} className="h-full w-full object-contain" /></span>
            <span className="font-bold text-xl tracking-tight text-white">MMS1</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex flex-1 min-w-0 items-center justify-start space-x-1 overflow-x-auto pl-1">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'group relative flex items-center space-x-1.5 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-cyan-300/10 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35),0_0_18px_rgba(34,211,238,0.12)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      !isActive && 'group-hover:scale-110'
                    )}
                  />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-full border border-white/40 bg-white/10 px-4 text-white shadow-sm backdrop-blur transition-all duration-200 hover:bg-white hover:text-red-600 hover:shadow-md flex-shrink-0 ml-2"
          >
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3">
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-cyan-300/10 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
