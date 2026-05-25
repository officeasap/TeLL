'use client'

import { useRef, useEffect } from 'react'
import { useCallStore } from '@/lib/store/call-store'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'

export function CallPanel() {
  const { activeCall, localStream, remoteStream, leaveCall } = useCallStore()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  if (!activeCall) return null

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) videoTrack.enabled = !videoTrack.enabled
    }
  }

  const isAudioMuted = localStream?.getAudioTracks()[0]?.enabled === false
  const isVideoOff = localStream?.getVideoTracks()[0]?.enabled === false

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        <div className="relative bg-black rounded-xl overflow-hidden">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3 text-white text-xs bg-black/50 px-2 py-1 rounded">You</div>
        </div>
        <div className="relative bg-black rounded-xl overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3 text-white text-xs bg-black/50 px-2 py-1 rounded">Other</div>
        </div>
      </div>
      <div className="flex justify-center gap-4 py-6">
        <button onClick={toggleAudio} className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20">
          {isAudioMuted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
        </button>
        <button onClick={toggleVideo} className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20">
          {isVideoOff ? <VideoOff className="h-5 w-5 text-white" /> : <Video className="h-5 w-5 text-white" />}
        </button>
        <button onClick={leaveCall} className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600">
          <PhoneOff className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  )
}