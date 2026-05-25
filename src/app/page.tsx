'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const client = getSupabaseClient()
      if (!client) {
        router.replace('/setup')
        return
      }

      const { data: { session } } = await client.auth.getSession()
      if (session) {
        // User is logged in → go to dashboard
        router.replace('/dashboard')
      } else {
        router.replace('/auth')
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#175507] gap-4">
      <div className="text-4xl font-bold text-white">Tell</div>
      <Loader2 className="h-6 w-6 animate-spin text-[#4DA6FF]" />
    </div>
  )
}