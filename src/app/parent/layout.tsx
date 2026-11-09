'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { BookOpen, Home, Wallet, CalendarDays } from 'lucide-react'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['parent']}>
      <div className="mms1-app min-h-screen overflow-x-hidden">
        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 sm:px-6 sm:py-6 sm:pb-28 lg:py-8">{children}</main>
        <MobileBottomNav items={[
          { href: '/parent', label: 'Home', icon: Home },
          { href: '/parent#communication-book', label: 'Daily book', icon: BookOpen },
          { href: '/parent#fee-history', label: 'Fees', icon: Wallet },
          { href: '/parent#leave-request', label: 'Leave', icon: CalendarDays },
        ]} />
      </div>
    </ProtectedRoute>
  )
}
