'use client'

import { useState } from 'react'
import { X, Trash2, MessageSquare } from 'lucide-react'

interface ClearChatModalProps {
  isOpen: boolean
  onClose: () => void
  onClearSingle: () => void
  onClearAll: () => void
  connectionName?: string
}

export function ClearChatModal({ 
  isOpen, 
  onClose, 
  onClearSingle, 
  onClearAll,
  connectionName 
}: ClearChatModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="neumorph-panel p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Clear Chat History</h3>
          <button onClick={onClose} className="neumorph-icon p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onClearSingle}
            className="w-full neumorph-btn-gray flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-[#2ECC71]" />
              <div>
                <p className="font-medium text-white">Clear Single Chat</p>
                <p className="text-xs text-[#F5F5F5]/50">Remove all messages with {connectionName || 'this contact'}</p>
              </div>
            </div>
            <Trash2 className="h-4 w-4 text-[#E74C3C]" />
          </button>
          
          <button
            onClick={onClearAll}
            className="w-full neumorph-btn-gray flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-[#E74C3C]" />
              <div>
                <p className="font-medium text-white">Clear All Chats</p>
                <p className="text-xs text-[#F5F5F5]/50">Remove ALL conversation history</p>
              </div>
            </div>
            <Trash2 className="h-4 w-4 text-[#E74C3C]" />
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t border-[#1E2A78]/20">
          <button onClick={onClose} className="w-full neumorph-btn-gray py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}