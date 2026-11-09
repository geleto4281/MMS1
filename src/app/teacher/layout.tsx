'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { TeacherNav } from '@/components/TeacherNav'

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <div className="mms1-app min-h-screen overflow-x-hidden">
        <TeacherNav />
        <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-6 sm:pb-28 lg:py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
