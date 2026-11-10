'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, ClipboardCheck, Users, Wallet } from 'lucide-react'
import NeonWaveBackground from '@/components/NeonWaveBackground'
import { PreferencesControls } from '@/components/PreferencesControls'
import { usePreferences } from '@/context/PreferencesContext'

const features = [
  {
    icon: ClipboardCheck,
    title: 'Attendance made clear',
    description: 'Review daily presence and follow up quickly when a learner is away.',
    color: 'bg-emerald-500',
  },
  {
    icon: BookOpen,
    title: 'Learning that moves forward',
    description: 'Keep Quran, Qaida, revision, and exam progress in one place.',
    color: 'bg-sky-500',
  },
  {
    icon: Users,
    title: 'A stronger parent connection',
    description: 'Share daily notes, acknowledge home revision, and keep conversations open.',
    color: 'bg-amber-500',
  },
]

export function PublicLanding() {
  const { t } = usePreferences()

  return (
    <main className="mms-public-page min-h-screen">
      <section className="mms-public-hero relative overflow-hidden">
        <NeonWaveBackground />
        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-5 sm:px-8 sm:pb-28 sm:pt-7">
          <nav className="flex items-center justify-between gap-4" aria-label="Main navigation">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="mms-logo-badge h-12 w-12 shrink-0">
                <Image src="/image/mms1-logo.png" alt="MMS logo" width={44} height={44} className="h-full w-full object-contain p-1" priority />
              </span>
              <span className="truncate text-lg font-bold tracking-tight text-white">MMS1</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <PreferencesControls />
              <Link href="/login" className="mms-public-nav-login">{t('Sign in')}</Link>
            </div>
          </nav>
          <div className="grid items-center gap-10 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
            <div className="max-w-2xl">
              <span className="mms-public-eyebrow"><span className="h-2 w-2 rounded-full bg-emerald-300" />{t('Built for the whole school community')}</span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
                {t('A clearer view of every learner’s journey.')}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                {t('Attendance, learning progress, fees, and family communication — together in one calm, simple workspace.')}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="mms-public-primary-button">{t('Access your account')}<ArrowRight className="h-4 w-4" /></Link>
                <a href="#features" className="mms-public-secondary-button">{t('Explore the portal')}</a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-300" />{t('Attendance made clear')}</span>
                <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-300" />{t('Learning that moves forward')}</span>
              </div>
            </div>
            <div className="mms-public-preview">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div><p className="text-sm font-semibold text-white">{t('School Management System')}</p><p className="mt-1 text-xs text-slate-400">{t('Designed for your school community')}</p></div>
                <span className="mms-logo-badge h-12 w-12"><Image src="/image/mms1-logo.png" alt="" width={42} height={42} className="h-full w-full object-contain p-1" /></span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5">
                <div className="mms-preview-tile"><span className="mms-preview-icon text-emerald-300"><ClipboardCheck /></span><span className="text-xs text-slate-400">{t('Attendance')}</span><strong>{t('Attendance made clear')}</strong><span className="h-1.5 w-4/5 rounded-full bg-emerald-300/70" /></div>
                <div className="mms-preview-tile"><span className="mms-preview-icon text-cyan-300"><BookOpen /></span><span className="text-xs text-slate-400">{t('Students')}</span><strong>{t('Learning that moves forward')}</strong><span className="h-1.5 w-3/5 rounded-full bg-cyan-300/70" /></div>
                <div className="mms-preview-tile"><span className="mms-preview-icon text-amber-300"><Wallet /></span><span className="text-xs text-slate-400">{t('Fees')}</span><strong>{t('Fee history')}</strong><span className="h-1.5 w-2/3 rounded-full bg-amber-300/70" /></div>
                <div className="mms-preview-tile"><span className="mms-preview-icon text-violet-300"><Users /></span><span className="text-xs text-slate-400">{t('Parents')}</span><strong>{t('A stronger parent connection')}</strong><span className="h-1.5 w-3/4 rounded-full bg-violet-300/70" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mms-public-features">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mms-public-section-label">{t('Built for the whole school community')}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('Everything your Madrasah needs to stay connected.')}</h2>
            <p className="mt-4 text-slate-400">{t('One welcoming workspace for administrators, teachers, and families.')}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return <article key={feature.title} className="mms-public-feature-card">
                <span className={`mms-public-feature-icon ${feature.color}`}><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-lg font-semibold text-white">{t(feature.title)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{t(feature.description)}</p>
              </article>
            })}
          </div>
        </div>
      </section>
      <footer className="mms-public-footer">
        <p>© {new Date().getFullYear()} MMS1 · {t('School Management System')}</p>
      </footer>
    </main>
  )
}
