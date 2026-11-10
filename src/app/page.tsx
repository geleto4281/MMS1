import type { Metadata } from 'next'
import { PublicLanding } from '@/components/PublicLanding'

export const metadata: Metadata = {
  title: {
    absolute: 'MMS - Madrasah Management System',
  },
}

export default function Home() {
  return <PublicLanding />
}
