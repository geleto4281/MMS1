'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminNav } from '@/components/AdminNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="mms1-app min-h-screen overflow-x-hidden">
        <AdminNav />
        <main className="mms-dashboard mx-auto w-full max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-6 sm:pb-28 lg:mx-0 lg:ml-60 lg:w-[calc(100%-15rem)] lg:max-w-none lg:px-6 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
