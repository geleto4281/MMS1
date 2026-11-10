'use client'

import { 
  GraduationCap,
  ClipboardList,
  Calendar,
  User,
  Users,
  FileText,
  BookOpen,
  LayoutDashboard,
} from 'lucide-react'
import { AbsenceAlertBell } from '@/components/AbsenceAlertBell'
import { AttendanceReminderBell } from '@/components/AttendanceReminderBell'
import { AnnouncementBell } from '@/components/AnnouncementBell'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { DashboardTopBar } from '@/components/DashboardTopBar'


export function TeacherNav() {
  const links = [
    { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/teacher/classes', label: 'My Classes', icon: GraduationCap },
    { href: '/teacher/students', label: 'Students', icon: Users },
    { href: '/teacher/exams', label: 'Exams & Results', icon: FileText },
    { href: '/teacher/mutabaah', label: 'Student performance', icon: BookOpen },
    { href: '/teacher/attendance', label: 'Take Attendance', icon: ClipboardList },
    { href: '/teacher/history', label: 'History', icon: Calendar },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <>
      <DashboardTopBar
        role="teacher"
        links={links}
        alerts={<><AttendanceReminderBell dark /><AbsenceAlertBell teacherOnly dark /></>}
        announcement={<AnnouncementBell dark />}
      />
      <MobileBottomNav items={[
        { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/teacher/classes', label: 'Classes', icon: GraduationCap },
        { href: '/teacher/attendance', label: 'Attendance', icon: ClipboardList },
        { href: '/teacher/mutabaah', label: 'Mutaba’ah', icon: BookOpen },
        { href: '/profile', label: 'Profile', icon: User },
      ]} />
    </>
  )
}
