import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ClipboardCheck, PhoneCall, BarChart3, ArrowRight } from 'lucide-react'
import NeonWaveBackground from '@/components/NeonWaveBackground'

export const metadata: Metadata = {
  title: 'Home',
}

const features = [
  {
    icon: ClipboardCheck,
    title: 'Real-time Attendance',
    description: 'Teachers mark Present, Absent or Late in seconds. Admins see the full picture instantly.',
    color: 'bg-emerald-500',
  },
  {
    icon: PhoneCall,
    title: 'Parent Contact',
    description: 'Absent students are collected automatically with parent phone numbers for quick follow-up.',
    color: 'bg-sky-500',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Beautiful charts for grades, gender balance and daily attendance trends.',
    color: 'bg-amber-500',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      <section className="relative overflow-hidden text-white">
        <NeonWaveBackground />

        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <Image
              src="/image/khandaq-logo.png"
              alt="MMS1 logo"
              width={200}
              height={200}
              priority
              className="h-auto w-40 rounded-full shadow-2xl ring-1 ring-white/25 md:w-52"
            />
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            MMS1 <span className="text-cyan-200">School Management System</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-300 md:text-xl">
            Track attendance, manage students, and keep parents informed —
            all in one beautiful place.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group btn inline-flex items-center gap-2 rounded-xl border border-cyan-200/50 bg-cyan-300 px-8 py-3.5 font-semibold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
            >
              Login
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <svg className="absolute bottom-0 left-0 right-0 w-full text-[#070b12]" viewBox="0 0 1440 60" fill="currentColor" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" />
        </svg>
      </section>

      {/* Everything you need — modern gradient background */}
      <section className="relative overflow-hidden bg-[#070b12]">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 right-0 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-4 text-center text-3xl font-bold text-white">Everything you need</h2>
        <p className="mb-12 text-center text-lg text-slate-400">
          A complete attendance management solution for your madresah. From real-time attendance tracking to parent notifications and insightful reports, we&apos;ve got you covered.
        </p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="h-full rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-yellow-300 p-[1px] shadow-[0_0_24px_rgba(34,211,238,0.12)] transition-shadow hover:shadow-[0_0_36px_rgba(34,211,238,0.24)]"
              >
                <div className="h-full rounded-[14px] bg-[#0c1421] p-8">
                  <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.color} text-white shadow-md`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-white">{f.title}</h3>
                  <p className="text-slate-400">{f.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#080d16] py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} MMS1 School Management System. All rights reserved.
      </footer>
    </main>
  )
}