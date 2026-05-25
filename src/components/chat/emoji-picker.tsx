'use client'

import { useState } from 'react'

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😂', '🥲', '😊', '😍', '🥰', '😎', '🤩', '😜', '🤔', '😏', '😅', '😢', '😭', '😤', '🤯', '🥳', '😴', '🙄', '😬'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '👀', '🫡', '🙏', '❤️', '🔥', '⭐', '💯', '✅', '❌', '⚡', '🎉', '🚀'],
  },
  {
    name: 'Objects',
    emojis: ['💡', '📌', '📎', '🔗', '📝', '📊', '🎯', '🏆', '💰', '⏰', '📢', '🔔', '💬', '🔧', '🎨', '📦', '🧪', '🐛', '🏗️', '🚢'],
  },
]

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🚀']

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(0)

  const filteredCategories = search
    ? EMOJI_CATEGORIES.map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter(() => true),
      }))
    : EMOJI_CATEGORIES

  return (
    <div
      className="w-72 border rounded-lg shadow-lg p-2 z-50"
      style={{ background: '#1A5E0A', borderColor: '#4DA6FF30' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1 mb-2 border-b pb-2" style={{ borderColor: '#4DA6FF30' }}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              activeCategory === i
                ? 'bg-[#4DA6FF] text-[#175507]'
                : 'text-[#B8E4A0] hover:bg-[#4DA6FF20]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
        {filteredCategories[activeCategory]?.emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-[#4DA6FF20] text-lg transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}