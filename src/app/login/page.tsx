'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useLogin } from '@/hooks/useAuth'
import NeonWaveBackground from '@/components/NeonWaveBackground'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PreferencesControls } from '@/components/PreferencesControls'
import { usePreferences } from '@/context/PreferencesContext'
import { Lock, Mail, Loader2, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const { t } = usePreferences()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetError, setResetError] = useState('')
  const [sending, setSending] = useState(false)

  const loginUser = useLogin()
  const router = useRouter()

  const handleForgotPassword = async () => {
    setResetMsg('')
    setResetError('')
    if (!email.trim()) {
      setResetError(t('Please enter your email address.'))
      return
    }
    setSending(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetMsg(t('Password reset email sent. Please check your inbox.'))
    } catch (err: any) {
      setResetError(err.message || t('Failed to send reset email. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (forgotMode) {
      await handleForgotPassword()
      return
    }

    setIsLoading(true)

    const result = await loginUser(email, password)

    if (result.success) {
      // Go straight to the right dashboard. The `profile` was read during
      // login, so we skip the extra /dashboard -> /admin (or /teacher)
      // navigation and its accompanying layout + fresh data subscriptions.
      const role = result.profile?.role
      const next =
        role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : role === 'parent' ? '/parent' : '/dashboard'
      router.replace(next)
    } else {
      setError(result.error || 'Login failed')
    }

    setIsLoading(false)
  }

  return (
    <div className="mms-login-page relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <NeonWaveBackground />
      <div className="absolute right-4 top-4 z-20"><PreferencesControls /></div>
      <Card className="mms-login-card relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b111c]/95 text-slate-100 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <CardHeader className='space-y-1 pt-8'>
          <div className='mms-logo-badge mx-auto mb-3 h-20 w-20'>
            <Image src='/image/mms1-logo.png' alt='MMS logo' width={72} height={72} className='h-full w-full object-contain p-1' />
          </div>
          <CardTitle className="text-center text-2xl font-bold text-white">
            MMS1
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            {forgotMode ? t('Reset your password') : t('Sign in to your account to continue')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {forgotMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('Email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 border-slate-500 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-300"
                      required
                    />
                  </div>
                </div>

                {resetError && (
                  <Alert variant="destructive">
                    <AlertDescription>{resetError}</AlertDescription>
                  </Alert>
                )}
                {resetMsg && (
                  <Alert variant="success">
                    <AlertDescription>{resetMsg}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('Sending...')}
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      {t('Send Password Reset Link')}
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false)
                      setResetMsg('')
                      setResetError('')
                    }}
                    className="text-cyan-300 hover:underline"
                  >
                    {t('Back to sign in')}
                  </button>
                </p>
              </>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t('Email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 border-slate-500 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-300"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('Password')}</Label>
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-sm text-cyan-300 hover:underline"
                    >
                      {t('Forgot password?')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 border-slate-500 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-300"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('Signing in...')}
                    </>
                  ) : (
                    t('Sign In')
                  )}
                </Button>
              </>
            )}
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            <p>{t('Need access? Contact the madresah administrator to create your account.')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
