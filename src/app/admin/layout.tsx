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
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
