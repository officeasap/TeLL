'use client'

import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useCallStore } from '@/lib/store/call-store'
import { useAppStore } from '@/lib/store/app-store'

export function CallListener() {
  const { user } = useAppStore()
  const { setIncomingCall, activeCall } = useCallStore()

  useEffect(() => {
    if (!user) return
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Supabase client not available – call listener disabled')
      return
    }

    const channel = client.channel('call-listener')
    channel
      .on('broadcast', { event: 'call_started' }, async ({ payload }) => {
        if (payload.callerId !== user.id && !activeCall) {
          setIncomingCall({
            callId: payload.callId,
            connectionId: payload.connectionId,
            callerId: payload.callerId,
            callerName: payload.callerName,
            displayName: payload.displayName,
            isVideo: payload.isVideo,
            signal: null,
          })
        }
      })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload.to === user.id && !activeCall) {
          const { incomingCall } = useCallStore.getState()
          if (incomingCall && incomingCall.callId === payload.callId) {
            setIncomingCall({ ...incomingCall, signal: payload.signal })
            const { acceptCall } = useCallStore.getState()
            acceptCall()
          }
        } else if (activeCall && payload.from !== user.id) {
          const { peer } = useCallStore.getState()
          if (peer) peer.signal(payload.signal)
        }
      })
      .subscribe((status, err) => {
        if (err) console.error('Call listener subscribe error:', err)
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user, activeCall, setIncomingCall])

  return null
}