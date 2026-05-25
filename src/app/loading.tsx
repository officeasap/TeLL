// src/app/loading.tsx
'use client'

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#175507] z-50">
      <img 
        src="/tell-icons/tell-logo.png" 
        alt="Tell" 
        width={48} 
        height={48}
        className="animate-pulse"
      />
    </div>
  )
}