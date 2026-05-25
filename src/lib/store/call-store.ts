// src/lib/store/call-store.ts – FULLY WORKING NUCLEAR VERSION
import { create } from 'zustand'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/app-store'
import Peer from 'simple-peer'

export interface Call {
  id: string
  connectionId: string
  displayName: string
  startedBy: string
  startedAt: Date
  isVideo: boolean
}

interface CallStore {
  activeCall: Call | null
  incomingCall: any | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  peer: Peer.Instance | null
  startCall: (connectionId: string, displayName: string, isVideo: boolean) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  leaveCall: () => void
  setIncomingCall: (call: any | null) => void
}

let outgoingRingtone: HTMLAudioElement | null = null
let incomingRingtone: HTMLAudioElement | null = null

export const useCallStore = create<CallStore>((set, get) => ({
  activeCall: null,
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  peer: null,

  startCall: async (connectionId, displayName, isVideo) => {
    const { user } = useAppStore.getState()
    if (!user) return

    // Play outgoing ringtone
    if (outgoingRingtone) {
      outgoingRingtone.pause()
      outgoingRingtone = null
    }
    outgoingRingtone = new Audio('/tell-ringtons/ringtone1.mp3')
    outgoingRingtone.loop = true
    outgoingRingtone.play().catch(() => {})

    const constraints = isVideo ? { audio: true, video: true } : { audio: true, video: false }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      console.error('Media error:', err)
      alert('Cannot access microphone. Please grant permissions.')
      if (outgoingRingtone) {
        outgoingRingtone.pause()
        outgoingRingtone = null
      }
      return
    }
    set({ localStream: stream })

    const callId = crypto.randomUUID()
    const newCall: Call = {
      id: callId,
      connectionId,
      displayName,
      startedBy: user.id,
      startedAt: new Date(),
      isVideo,
    }
    set({ activeCall: newCall })

    const peer = new Peer({ initiator: true, trickle: false, stream })
    set({ peer })

    peer.on('signal', async (signal) => {
      const client = getSupabaseClient()
      if (!client) return
      
      const channel = client.channel(`tell-call:${connectionId}`)
      await new Promise<void>((resolve) => {
        channel.subscribe((status, err) => {
          if (err) console.error('Subscribe error:', err)
          resolve()
        })
      })
      
      await channel.httpSend('broadcast', {
        event: 'signal',
        payload: { signal, from: user.id, to: null, callId, isVideo }
      })
    })

    peer.on('stream', (remoteStream) => {
      set({ remoteStream })
      // Stop outgoing ringtone on connect
      if (outgoingRingtone) {
        outgoingRingtone.pause()
        outgoingRingtone = null
      }
    })

    peer.on('close', () => {
      if (outgoingRingtone) {
        outgoingRingtone.pause()
        outgoingRingtone = null
      }
      get().leaveCall()
    })

    const client = getSupabaseClient()
    if (client) {
      const broadcastChannel = client.channel(`broadcast:${connectionId}`)
      await new Promise<void>((resolve) => {
        broadcastChannel.subscribe((status, err) => {
          if (err) console.error('Subscribe error:', err)
          resolve()
        })
      })
      await broadcastChannel.httpSend('broadcast', {
        event: 'call_started',
        payload: {
          callId,
          connectionId,
          callerId: user.id,
          callerName: user.display_name,
          displayName,
          isVideo,
        },
      })
    }
  },

  acceptCall: async () => {
    const { incomingCall } = get()
    if (!incomingCall) return
    const { user } = useAppStore.getState()
    if (!user) return

    // Stop incoming ringtone
    if (incomingRingtone) {
      incomingRingtone.pause()
      incomingRingtone = null
    }

    const constraints = incomingCall.isVideo ? { audio: true, video: true } : { audio: true, video: false }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      console.error('Media error:', err)
      alert('Cannot access microphone. Please grant permissions.')
      return
    }
    set({ localStream: stream })

    const peer = new Peer({ initiator: false, trickle: false, stream })
    set({ peer })

    peer.on('signal', async (signal) => {
      const client = getSupabaseClient()
      if (!client) return
      
      const channel = client.channel(`tell-call:${incomingCall.connectionId}`)
      await new Promise<void>((resolve) => {
        channel.subscribe((status, err) => {
          if (err) console.error('Subscribe error:', err)
          resolve()
        })
      })
      
      await channel.httpSend('broadcast', {
        event: 'signal',
        payload: { signal, from: user.id, to: incomingCall.callerId }
      })
    })

    peer.on('stream', (remoteStream) => {
      set({ remoteStream })
    })

    peer.on('close', () => {
      get().leaveCall()
    })

    if (incomingCall.signal) {
      peer.signal(incomingCall.signal)
    }

    set({
      activeCall: {
        id: incomingCall.callId,
        connectionId: incomingCall.connectionId,
        displayName: incomingCall.displayName,
        startedBy: incomingCall.callerId,
        startedAt: new Date(),
        isVideo: incomingCall.isVideo,
      },
      incomingCall: null,
    })
  },

  rejectCall: () => {
    if (incomingRingtone) {
      incomingRingtone.pause()
      incomingRingtone = null
    }
    set({ incomingCall: null })
  },

  leaveCall: () => {
    const { peer, localStream } = get()
    if (peer) peer.destroy()
    if (localStream) localStream.getTracks().forEach(track => track.stop())
    if (outgoingRingtone) {
      outgoingRingtone.pause()
      outgoingRingtone = null
    }
    if (incomingRingtone) {
      incomingRingtone.pause()
      incomingRingtone = null
    }
    set({ activeCall: null, localStream: null, remoteStream: null, peer: null })
  },

  setIncomingCall: (incomingCall) => {
    if (incomingCall) {
      if (incomingRingtone) {
        incomingRingtone.pause()
        incomingRingtone = null
      }
      incomingRingtone = new Audio('/tell-ringtons/ringtone2.mp3')
      incomingRingtone.loop = true
      incomingRingtone.play().catch(() => {})
    } else {
      if (incomingRingtone) {
        incomingRingtone.pause()
        incomingRingtone = null
      }
    }
    set({ incomingCall })
  },
}))