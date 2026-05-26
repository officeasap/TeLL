'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useCallStore } from '@/lib/store/call-store'
import { useAppStore } from '@/lib/store/app-store'

export function CallListener() {
  const { user } = useAppStore()
  const { setIncomingCall, activeCall, acceptCall } = useCallStore()
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

  // Detect user interaction (required for mobile audio)
  useEffect(() => {
    const handleInteraction = () => {
      setHasUserInteracted(true)
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
    }
    document.addEventListener('click', handleInteraction)
    document.addEventListener('touchstart', handleInteraction)
    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const client = getSupabaseClient()
    if (!client) {
      console.warn('Supabase client not available')
      return
    }

    const channel = client.channel('call-listener')
    channel
      .on('broadcast', { event: 'call_started' }, async ({ payload }) => {
        if (payload.callerId !== user.id && !activeCall) {
          // Play ringtone only after user interaction
          if (hasUserInteracted) {
            try {
              const ringtone = new Audio('/tell-ringtons/ringtone2.mp3')
              ringtone.loop = true
              ringtone.play().catch(e => console.log('Ringtone play error:', e))
              // Store ringtone to stop later
              ;(window as any).currentRingtone = ringtone
            } catch (e) {
              console.log('Could not play ringtone:', e)
            }
          }
          
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
            // Stop ringtone before accepting
            if ((window as any).currentRingtone) {
              (window as any).currentRingtone.pause()
              (window as any).currentRingtone = null
            }
            setIncomingCall({ ...incomingCall, signal: payload.signal })
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
      if ((window as any).currentRingtone) {
        (window as any).currentRingtone.pause()
        (window as any).currentRingtone = null
      }
    }
  }, [user, activeCall, setIncomingCall, acceptCall, hasUserInteracted])

  return null
}