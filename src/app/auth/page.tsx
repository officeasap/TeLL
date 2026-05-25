'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Loader2, Mail, ArrowLeft, KeyRound } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'
type View = 'loading' | 'form' | 'forgot-password' | 'reset-password' | 'reset-email-sent'

function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [view, setView] = useState<View>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) {
      setView('form')
      return
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset-password')
        return
      }
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
        return
      }
    })

    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    if (code) {
      client.auth.exchangeCodeForSession(code).catch(() => setView('form'))
    }

    const hash = window.location.hash
    const hasHashTokens = hash.includes('access_token=')
    if (hasHashTokens && !code) {
      const hashParams = new URLSearchParams(hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      if (accessToken && refreshToken) {
        client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }

    const timeout = setTimeout(() => {
      setView((current) => (current === 'loading' ? 'form' : current))
    }, 500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const client = getSupabaseClient()
    if (!client) return

    setLoading(true)
    setError(null)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        })
        if (signUpError) throw signUpError
        if (data.session) {
          router.push('/dashboard')
        } else {
          alert('Check your email for confirmation link!')
          setView('form')
        }
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    const client = getSupabaseClient()
    if (!client || !email) return

    setLoading(true)
    setError(null)

    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?recovery=true`,
      })
      if (error) throw error
      setView('reset-email-sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    const client = getSupabaseClient()
    if (!client) return

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const errorBanner = error && (
    <div className="p-3 bg-[#E74C3C]/10 border border-[#E74C3C]/30 rounded-xl">
      <p className="text-sm text-[#E74C3C]">{error}</p>
    </div>
  )

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E2A78]" />
      </div>
    )
  }

  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center p-6">
        <div className="max-w-md w-full neumorph-panel p-8">
          <div className="text-center mb-6">
            <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-12 w-auto mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Forgot password?</h2>
            <p className="text-sm text-[#F5F5F5]/60">Enter your email and we'll send you a reset link.</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl text-base px-5 py-3"
              required
              autoFocus
            />
            {errorBanner}
            <button type="submit" disabled={loading} className="w-full neumorph-btn-primary py-3 text-base">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send Reset Link'}
            </button>
            <button type="button" onClick={() => setView('form')} className="w-full neumorph-btn-gray py-3 text-base">
              Back to Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (view === 'reset-email-sent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center p-6">
        <div className="max-w-md w-full neumorph-panel p-8 text-center">
          <Mail className="h-12 w-12 text-[#1E2A78] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-sm text-[#F5F5F5]/60 mb-6">
            We sent a password reset link to <strong>{email}</strong>
          </p>
          <button onClick={() => setView('form')} className="w-full neumorph-btn-primary py-3">
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  if (view === 'reset-password') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center p-6">
        <div className="max-w-md w-full neumorph-panel p-8">
          <div className="text-center mb-6">
            <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-12 w-auto mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Reset your password</h2>
            <p className="text-sm text-[#F5F5F5]/60">Enter your new password below.</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl text-base px-5 py-3"
              required
              minLength={6}
              autoFocus
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl text-base px-5 py-3"
              required
              minLength={6}
            />
            {errorBanner}
            <button type="submit" disabled={loading} className="w-full neumorph-btn-primary py-3 text-base">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center p-6">
      <div className="max-w-md w-full neumorph-panel p-8">
        <div className="text-center mb-6">
          <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-14 w-auto mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-[#F5F5F5]/60">
            {mode === 'signin' ? 'Sign in to continue' : 'Join the sovereign network'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-xl text-base px-5 py-3"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl text-base px-5 py-3"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl text-base px-5 py-3"
            required
            minLength={6}
          />

          {errorBanner}

          <button type="submit" disabled={loading} className="w-full neumorph-btn-primary py-3 text-base">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
              }}
              className="text-sm text-[#F5F5F5]/60 hover:text-white transition-colors"
            >
              {mode === 'signin'
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </button>
          </div>

          {mode === 'signin' && (
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setView('forgot-password')}
                className="text-sm text-[#2ECC71] hover:text-[#1E2A78] transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E2A78]" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  )
}