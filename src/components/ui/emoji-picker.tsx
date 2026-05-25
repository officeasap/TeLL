'use client'

import { useState, useRef, useEffect } from 'react'
import { Smile } from 'lucide-react'
import { Picker } from 'emoji-mart'
import 'emoji-mart/css/emoji-mart.css'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  className?: string
}

export function EmojiPicker({ onEmojiSelect, className = '' }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="p-2 rounded-full hover:bg-[#4DA6FF20] transition-colors"
        aria-label="Add emoji"
      >
        <Smile className="h-5 w-5 text-[#B8E4A0]" />
      </button>

      {showPicker && (
        <div className="absolute bottom-full mb-2 left-0 z-50 shadow-xl rounded-xl overflow-hidden border border-[#4DA6FF30]">
          {/* @ts-expect-error - emoji-mart Picker has incomplete type definitions but works at runtime */}
          <Picker
            onSelect={(emoji: any) => {
              onEmojiSelect(emoji.native)
              setShowPicker(false)
            }}
            style={{
              backgroundColor: '#1A5E0A',
              border: '1px solid #4DA6FF30',
              borderRadius: '12px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            }}
            theme="dark"
            showPreview={false}
            showSkinTones={false}
          />
        </div>
      )}
    </div>
  )
}