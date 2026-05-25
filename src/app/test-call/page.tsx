'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import Peer from 'simple-peer'

export default function TestCallPage() {
  const [userId, setUserId] = useState<string>('')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callActive, setCallActive] = useState(false)
  const [incomingCall, setIncomingCall] = useState<{ from: string; signal: any } | null>(null)
  const peerRef = useRef<Peer.Instance | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  // Generate user ID only on client (hydration-safe)
  useEffect(() => {
    setUserId(`user-${Math.random().toString(36).slice(2, 8)}`)
  }, [])

  // Get user media on page load
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      })
      .catch(err => console.error('Media error:', err))
  }, [])

  // Setup Supabase Realtime listener for incoming calls
  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) return

    const channel = client.channel('test-call-signaling')
    channel
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        console.log('Received call offer from', payload.from)
        setIncomingCall({ from: payload.from, signal: payload.signal })
      })
      .on('broadcast', { event: 'call-answer' }, ({ payload }) => {
        console.log('Received call answer')
        if (peerRef.current) peerRef.current.signal(payload.signal)
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [])

  // Start a call (initiator)
  const startCall = () => {
    if (!localStream) return alert('Waiting for camera/mic...')
    if (!userId) return alert('User ID not ready')

    const peer = new Peer({ initiator: true, trickle: false, stream: localStream })
    peerRef.current = peer

    peer.on('signal', async (signal) => {
      const client = getSupabaseClient()
      if (!client) return
      const channel = client.channel('test-call-signaling')
      await channel.subscribe()
      channel.send({
        type: 'broadcast',
        event: 'call-offer',
        payload: { from: userId, signal }
      })
    })

    peer.on('stream', (stream) => {
      setRemoteStream(stream)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      setCallActive(true)
      setIncomingCall(null)
    })

    peer.on('close', () => {
      setCallActive(false)
      setRemoteStream(null)
      peerRef.current = null
    })

    setCallActive(true)
  }

  // Accept incoming call (receiver)
  const acceptCall = () => {
    if (!incomingCall || !localStream) return

    const peer = new Peer({ initiator: false, trickle: false, stream: localStream })
    peerRef.current = peer

    peer.on('signal', async (signal) => {
      const client = getSupabaseClient()
      if (!client) return
      const channel = client.channel('test-call-signaling')
      await channel.subscribe()
      channel.send({
        type: 'broadcast',
        event: 'call-answer',
        payload: { signal }
      })
    })

    peer.on('stream', (stream) => {
      setRemoteStream(stream)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      setCallActive(true)
      setIncomingCall(null)
    })

    peer.on('close', () => {
      setCallActive(false)
      setRemoteStream(null)
      peerRef.current = null
    })

    peer.signal(incomingCall.signal)
  }

  const endCall = () => {
    if (peerRef.current) peerRef.current.destroy()
    setCallActive(false)
    setRemoteStream(null)
  }

  return (
    <div className="min-h-screen bg-[#175507] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">🧪 Tell Call Test</h1>
        <div className="bg-[#1A5E0A] rounded-xl p-4 mb-6">
          <p className="text-white">Your ID: <code className="bg-black/30 px-2 py-1 rounded">{userId || 'Loading...'}</code></p>
          <p className="text-white/70 text-sm mt-1">Open this same page in another browser/incognito to test a call.</p>
        </div>

        {/* Video containers */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-black rounded-xl overflow-hidden aspect-video">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="text-center text-white/60 text-sm p-2">📹 You (local)</div>
          </div>
          <div className="bg-black rounded-xl overflow-hidden aspect-video">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="text-center text-white/60 text-sm p-2">👤 Remote (other person)</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 justify-center">
          {!callActive && !incomingCall && (
            <button
              onClick={startCall}
              className="px-6 py-3 bg-[#4DA6FF] text-[#175507] font-bold rounded-xl hover:opacity-90"
            >
              📞 Start a call
            </button>
          )}
          {incomingCall && !callActive && (
            <div className="flex gap-4">
              <button
                onClick={acceptCall}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl"
              >
                ✅ Accept call from {incomingCall.from}
              </button>
              <button
                onClick={() => setIncomingCall(null)}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl"
              >
                ❌ Reject
              </button>
            </div>
          )}
          {callActive && (
            <button
              onClick={endCall}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl"
            >
              🔴 End call
            </button>
          )}
        </div>

        <div className="mt-8 text-white/60 text-sm text-center">
          <p>⚡ This test uses only Supabase Realtime for signaling – no third‑party call servers.</p>
          <p>🔒 WebRTC peer‑to‑peer connection – your video/audio never passes through any server.</p>
        </div>
      </div>
    </div>
  )
}