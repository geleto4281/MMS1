'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['parent']}>
      <div className="mms1-app min-h-screen overflow-x-hidden">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
