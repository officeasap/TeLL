'use client'

import { Phone, X } from 'lucide-react'
import { useCallStore } from '@/lib/store/call-store'

export function IncomingCallBanner() {
  const { incomingCall, acceptCall, rejectCall } = useCallStore()

  if (!incomingCall) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-[#4DA6FF]">
        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
          <Phone className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{incomingCall.callerName} is calling</p>
          <p className="text-xs text-white/70">in #{incomingCall.channelName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={rejectCall}
            className="h-9 px-3 rounded-lg text-xs font-semibold bg-white/20 text-white"
          >
            <X className="h-3.5 w-3.5 inline mr-1" /> Dismiss
          </button>
          <button
            onClick={acceptCall}
            className="h-9 px-3 rounded-lg text-xs font-semibold bg-white text-[#4DA6FF]"
          >
            <Phone className="h-3.5 w-3.5 inline mr-1" /> Join
          </button>
        </div>
      </div>
    </div>
  )
}