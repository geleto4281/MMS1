'use client'

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  User,
  Settings,
  FileText,
  Wallet,
  CalendarDays,
} from 'lucide-react'
import { AbsenceAlertBell } from '@/components/AbsenceAlertBell'
import { AttendanceReminderBell } from '@/components/AttendanceReminderBell'
import { AnnouncementBell } from '@/components/AnnouncementBell'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { DashboardTopBar } from '@/components/DashboardTopBar'

export function AdminNav() {
  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/teachers', label: 'Users', icon: Users },
    { href: '/admin/parents', label: 'Parents', icon: Users },
    { href: '/admin/classes', label: 'Classes', icon: GraduationCap },
    { href: '/admin/students', label: 'Students', icon: GraduationCap },
    { href: '/admin/exams', label: 'Results', icon: FileText },
    { href: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
    { href: '/admin/fees', label: 'Fees', icon: Wallet },
    { href: '/admin/leave-requests', label: 'Leave Notices', icon: CalendarDays },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <>
      <DashboardTopBar
        role="admin"
        links={links}
        alerts={<><AttendanceReminderBell /><AbsenceAlertBell /></>}
        announcement={<AnnouncementBell />}
      />
      <MobileBottomNav items={[
        { href: '/admin', label: 'Home', icon: LayoutDashboard },
        { href: '/admin/students', label: 'Students', icon: Users },
        { href: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
        { href: '/admin/fees', label: 'Fees', icon: Wallet },
        { href: '/admin/classes', label: 'Classes', icon: GraduationCap },
      ]} />
    </>
  )
}
