'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/app-store'
import { Search, Hash, Lock, MessageSquare, User, Loader2, ArrowRight, Clock, Sparkles } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Channel, Message, Profile } from '@/types/database'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Result =
  | { type: 'channel'; channel: Channel }
  | { type: 'message'; message: Message & { sender?: Profile; channel_name?: string } }
  | { type: 'user'; user: Profile }

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { workspace, user, channels, dmChannels, setCurrentChannelId, setPreviewChannel, openProfile } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])  // ← FIXED: added = sign
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const search = useCallback(
    async (q: string) => {
      const client = getSupabaseClient()
      if (!client || !workspace || !user || !q.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      const all: Result[] = []

      try {
        const { data: myMemberships } = await client
          .from('channel_members')
          .select('channel_id')
          .eq('profile_id', user.id)

        const myChannelIds = new Set(myMemberships?.map((m) => m.channel_id) || [])

        // Search channels
        const { data: channelsData } = await client
          .from('channels')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('is_archived', false)
          .not('name', 'like', 'dm-%')
          .ilike('name', `%${q}%`)
          .limit(10)

        if (channelsData) {
          channelsData
            .filter((c) => !c.is_private || myChannelIds.has(c.id))
            .slice(0, 5)
            .forEach((c) => all.push({ type: 'channel', channel: c as Channel }))
        }

        // Search users - FIXED: Added null check with optional chaining
        const { data: members } = await client
          .from('workspace_members')
          .select('profile:profiles(*)')
          .eq('workspace_id', workspace.id)

        if (members) {
          const profiles = members
            .map((m: Record<string, unknown>) => m.profile as Profile)
            .filter(
              (p) =>
                p &&
                (p.display_name?.toLowerCase().includes(q.toLowerCase()) ||
                  p.email?.toLowerCase().includes(q.toLowerCase()))
            )
            .slice(0, 5)

          profiles.forEach((u) => all.push({ type: 'user', user: u }))
        }

        // Search messages
        if (myChannelIds.size > 0) {
          const { data: messages } = await client
            .from('messages')
            .select('*, sender:profiles(*)')
            .eq('is_deleted', false)
            .in('channel_id', [...myChannelIds])
            .ilike('content', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(10)

          if (messages) {
            const channelIds = [...new Set(messages.map((m) => m.channel_id))]
            const { data: channelData } = await client
              .from('channels')
              .select('id, name, is_private')
              .in('id', channelIds)

            const channelMap = new Map(channelData?.map((c) => [c.id, c.name]) || [])

            messages.forEach((m) =>
              all.push({
                type: 'message',
                message: { ...m, channel_name: channelMap.get(m.channel_id) || 'unknown' } as Message & { sender?: Profile; channel_name?: string },
              })
            )
          }
        }
      } catch (err) {
        console.error('Search error:', err)
      }

      setResults(all)
      setActiveIndex(-1)
      setLoading(false)
    },
    [workspace, user]
  )

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timeout = setTimeout(() => search(query), 300)
    return () => clearTimeout(timeout)
  }, [query, search])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setActiveIndex(-1)
    }
  }, [open])

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    const flatResults = results
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const r = flatResults[activeIndex]
      if (r.type === 'channel') handleSelectChannel(r.channel)
      else if (r.type === 'user') handleSelectUser(r.user.id)
      else if (r.type === 'message') handleSelectMessage(r.message.channel_id)
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && resultsRef.current) {
      const el = resultsRef.current.querySelector(`[data-index="${activeIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function handleSelectChannel(channel: Channel) {
    const isMember =
      channels.some((c) => c.id === channel.id) ||
      dmChannels.some((c) => c.id === channel.id)

    if (isMember) {
      setCurrentChannelId(channel.id)
    } else {
      setPreviewChannel(channel)
    }
    onOpenChange(false)
  }

  function handleSelectUser(userId: string) {
    openProfile(userId)
    onOpenChange(false)
  }

  function handleSelectMessage(channelId: string) {
    setCurrentChannelId(channelId)
    onOpenChange(false)
  }

  // Highlight matching text – Tell style
  function highlightMatch(text: string, q: string) {
    if (!q.trim()) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-[#4DA6FF30] text-[#4DA6FF] font-semibold rounded-sm px-0.5">
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    )
  }

  const channelResults = results.filter((r) => r.type === 'channel')
  const userResults = results.filter((r) => r.type === 'user')
  const messageResults = results.filter((r) => r.type === 'message')

  // Compute flat index for each result for keyboard nav
  const channelStartIndex = 0
  const userStartIndex = channelResults.length
  const messageStartIndex = channelResults.length + userResults.length

  // Quick actions for empty state
  const recentChannels = channels.slice(0, 3)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-xl shadow-2xl" style={{ background: '#1A5E0A', borderColor: '#4DA6FF30' }}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#4DA6FF30', background: '#0E3A05' }}>
          <Search className="h-5 w-5 shrink-0" style={{ color: '#B8E4A0' }} />
          <input
            ref={inputRef}
            placeholder="Search messages, channels, people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-[#B8E4A0]/50"
            style={{ color: '#FFFFFF' }}
            autoFocus
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#4DA6FF' }} />}
        </div>

        {/* Results area */}
        <div ref={resultsRef} className="max-h-[420px] overflow-y-auto">
          {!query.trim() ? (
            /* ===== EMPTY STATE ===== */
            <div className="px-4 py-5">
              {/* Recent channels */}
              {recentChannels.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Clock className="h-3.5 w-3.5" style={{ color: '#B8E4A0' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#B8E4A0' }}>
                      Recent
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {recentChannels.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => { setCurrentChannelId(ch.id); onOpenChange(false) }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#4DA6FF20] transition-colors text-left group"
                      >
                        <div className="h-7 w-7 rounded-md bg-[#4DA6FF20] flex items-center justify-center">
                          {ch.is_private ? (
                            <Lock className="h-3.5 w-3.5" style={{ color: '#B8E4A0' }} />
                          ) : (
                            <Hash className="h-3.5 w-3.5" style={{ color: '#B8E4A0' }} />
                          )}
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{ch.name}</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-auto transition-colors" style={{ color: 'transparent' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search tips */}
              <div className="rounded-lg border border-dashed border-[#4DA6FF40] p-4 text-center">
                <Sparkles className="mx-auto h-5 w-5 mb-2" style={{ color: '#4DA6FF' }} />
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Search your workspace</p>
                <p className="text-xs mt-1" style={{ color: '#B8E4A0' }}>
                  Find messages, channels, and people
                </p>
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            /* ===== NO RESULTS ===== */
            <div className="px-4 py-10 text-center">
              <Search className="mx-auto h-8 w-8 mb-3" style={{ color: '#B8E4A0' }} />
              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                No results for &quot;{query}&quot;
              </p>
              <p className="text-xs mt-1" style={{ color: '#B8E4A0' }}>
                Try a different search term
              </p>
            </div>
          ) : (
            /* ===== RESULTS ===== */
            <div className="py-1.5">
              {/* Channels */}
              {channelResults.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Hash className="h-3 w-3" style={{ color: '#B8E4A0' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#B8E4A0' }}>
                      Channels
                    </span>
                    <span className="text-[11px]" style={{ color: '#4DA6FF' }}>{channelResults.length}</span>
                  </div>
                  {channelResults.map((r, i) => {
                    if (r.type !== 'channel') return null
                    const idx = channelStartIndex + i
                    return (
                      <button
                        key={r.channel.id}
                        data-index={idx}
                        onClick={() => handleSelectChannel(r.channel)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 transition-colors text-left group',
                          activeIndex === idx ? 'bg-[#4DA6FF20]' : 'hover:bg-[#4DA6FF10]'
                        )}
                      >
                        <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                          activeIndex === idx ? 'bg-[#4DA6FF40]' : 'bg-[#4DA6FF20]'
                        )}>
                          {r.channel.is_private ? (
                            <Lock className="h-3.5 w-3.5" style={{ color: '#4DA6FF' }} />
                          ) : (
                            <Hash className="h-4 w-4" style={{ color: '#4DA6FF' }} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                            {highlightMatch(r.channel.name, query)}
                          </span>
                          {r.channel.description && (
                            <p className="text-xs truncate mt-0.5" style={{ color: '#B8E4A0' }}>
                              {r.channel.description}
                            </p>
                          )}
                        </div>
                        <ArrowRight className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-all',
                          activeIndex === idx ? 'text-[#4DA6FF] translate-x-0' : 'text-transparent -translate-x-1'
                        )} />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Users */}
              {userResults.length > 0 && (
                <div className="mb-1">
                  {(channelResults.length > 0) && <div className="mx-4 border-t border-[#4DA6FF30] my-1" />}
                  <div className="flex items-center gap-2 px-4 py-2">
                    <User className="h-3 w-3" style={{ color: '#B8E4A0' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#B8E4A0' }}>
                      People
                    </span>
                    <span className="text-[11px]" style={{ color: '#4DA6FF' }}>{userResults.length}</span>
                  </div>
                  {userResults.map((r, i) => {
                    if (r.type !== 'user') return null
                    const idx = userStartIndex + i
                    return (
                      <button
                        key={r.user.id}
                        data-index={idx}
                        onClick={() => handleSelectUser(r.user.id)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 transition-colors text-left group',
                          activeIndex === idx ? 'bg-[#4DA6FF20]' : 'hover:bg-[#4DA6FF10]'
                        )}
                      >
                        <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                          activeIndex === idx
                            ? 'bg-[#4DA6FF40] text-[#4DA6FF]'
                            : 'bg-[#4DA6FF20] text-[#4DA6FF]'
                        )}>
                          {r.user.avatar_url ? (
                            <img src={r.user.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            r.user.display_name?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                            {highlightMatch(r.user.display_name || '', query)}
                          </span>
                          {r.user.email && (
                            <p className="text-xs truncate mt-0.5" style={{ color: '#B8E4A0' }}>
                              {r.user.email}
                            </p>
                          )}
                        </div>
                        <div className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          r.user.is_online ? 'bg-green-500' : 'bg-gray-500'
                        )} />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Messages */}
              {messageResults.length > 0 && (
                <div>
                  {(channelResults.length > 0 || userResults.length > 0) && (
                    <div className="mx-4 border-t border-[#4DA6FF30] my-1" />
                  )}
                  <div className="flex items-center gap-2 px-4 py-2">
                    <MessageSquare className="h-3 w-3" style={{ color: '#B8E4A0' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#B8E4A0' }}>
                      Messages
                    </span>
                    <span className="text-[11px]" style={{ color: '#4DA6FF' }}>{messageResults.length}</span>
                  </div>
                  {messageResults.map((r, i) => {
                    if (r.type !== 'message') return null
                    const m = r.message
                    const idx = messageStartIndex + i
                    return (
                      <button
                        key={m.id}
                        data-index={idx}
                        onClick={() => handleSelectMessage(m.channel_id)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-2.5 transition-colors text-left group',
                          activeIndex === idx ? 'bg-[#4DA6FF20]' : 'hover:bg-[#4DA6FF10]'
                        )}
                      >
                        <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors',
                          activeIndex === idx
                            ? 'bg-[#4DA6FF40] text-[#4DA6FF]'
                            : 'bg-[#4DA6FF20] text-[#4DA6FF]'
                        )}>
                          {m.sender?.avatar_url ? (
                            <img src={m.sender.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            (m.sender?.display_name?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                              {m.sender?.display_name || 'Unknown'}
                            </span>
                            <span className="text-[11px]" style={{ color: '#B8E4A0' }}>
                              in #{m.channel_name}
                            </span>
                            <span className="text-[11px] ml-auto shrink-0" style={{ color: '#B8E4A0' }}>
                              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm truncate mt-0.5" style={{ color: '#B8E4A0' }}>
                            {highlightMatch(m.content, query)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-[11px]" style={{ borderColor: '#4DA6FF30', background: '#0E3A05' }}>
          <div className="flex items-center gap-1.5">
            <kbd className="h-4 min-w-4 px-1 rounded bg-[#1A5E0A] text-[10px] font-mono flex items-center justify-center border border-[#4DA6FF40]" style={{ color: '#B8E4A0' }}>↑</kbd>
            <kbd className="h-4 min-w-4 px-1 rounded bg-[#1A5E0A] text-[10px] font-mono flex items-center justify-center border border-[#4DA6FF40]" style={{ color: '#B8E4A0' }}>↓</kbd>
            <span style={{ color: '#B8E4A0' }}>navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="h-4 min-w-4 px-1 rounded bg-[#1A5E0A] text-[10px] font-mono flex items-center justify-center border border-[#4DA6FF40]" style={{ color: '#B8E4A0' }}>↵</kbd>
            <span style={{ color: '#B8E4A0' }}>open</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <kbd className="h-4 min-w-4 px-1 rounded bg-[#1A5E0A] text-[10px] font-mono flex items-center justify-center border border-[#4DA6FF40]" style={{ color: '#B8E4A0' }}>esc</kbd>
            <span style={{ color: '#B8E4A0' }}>close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}