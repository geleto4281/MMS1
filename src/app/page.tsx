import type { Metadata } from 'next'
import { PublicLanding } from '@/components/PublicLanding'

export const metadata: Metadata = {
  title: 'Home',
}

export default function Home() {
  return <PublicLanding />
}
