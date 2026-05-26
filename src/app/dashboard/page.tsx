'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/app-store'
import { useCallStore } from '@/lib/store/call-store'
import { CallPanel } from '@/components/call/CallPanel'
import { IncomingCallBanner } from '@/components/call/IncomingCallBanner'
import { CallListener } from '@/components/call/CallListener'
import { ClearChatModal } from '@/components/ui/clear-chat-modal'
import { 
  Loader2, 
  LogOut, 
  MessageSquare, 
  Users,
  Copy,
  Check,
  Search,
  X,
  Camera,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Music,
  Info
} from 'lucide-react'

const RINGTONES = [
  { name: 'Classic Bell', file: '/tell-ringtons/ringtone1.mp3' },
  { name: 'Soft Chime', file: '/tell-ringtons/ringtone2.mp3' },
  { name: 'Digital Pulse', file: '/tell-ringtons/ringtone3.mp3' },
  { name: 'Warm Melody', file: '/tell-ringtons/ringtone4.mp3' },
  { name: 'Crystal Clear', file: '/tell-ringtons/ringtone5.mp3' },
]

// Play message ringtone
let messageRingtone: HTMLAudioElement | null = null

export default function Dashboard() {
  const router = useRouter()
  const { user, setUser } = useAppStore()
  const { startCall, activeCall } = useCallStore()
  const [targetTell, setTargetTell] = useState('')
  const [connections, setConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Record<string, any[]>>({})
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [showCallOptions, setShowCallOptions] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ tell_number: string; display_name: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [showContacts, setShowContacts] = useState(true)
  const [selectedRingtone, setSelectedRingtone] = useState(RINGTONES[0].file)
  const [showRingtonePicker, setShowRingtonePicker] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, selectedConnection])

  // Play sound when new message arrives
  const playMessageSound = () => {
    if (messageRingtone) {
      messageRingtone.pause()
      messageRingtone = null
    }
    messageRingtone = new Audio('/tell-ringtons/ringtone3.mp3')
    messageRingtone.play().catch(() => {})
    setTimeout(() => {
      if (messageRingtone) {
        messageRingtone.pause()
        messageRingtone = null
      }
    }, 2000)
  }

  // Real-time message subscription
  useEffect(() => {
    if (!user || !selectedConnection) return
    const client = getSupabaseClient()
    if (!client) return
    
    const channel = client.channel(`messages:${selectedConnection}`)
    channel
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'tell_messages', filter: `connection_id=eq.${selectedConnection}` }, 
        (payload) => {
          const newMessage = payload.new as any
          if (newMessage.sender_tell !== user.tell_number) {
            // Play ringtone for incoming message
            playMessageSound()
            setMessages(prev => ({
              ...prev,
              [selectedConnection]: [...(prev[selectedConnection] || []), newMessage]
            }))
          }
        }
      )
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [user, selectedConnection])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  async function uploadAvatar(file: File) {
    const client = getSupabaseClient()
    if (!client || !user) {
      alert('Not authenticated')
      return
    }

    setUploadingAvatar(true)
    try {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        alert('Image must be less than 2MB')
        return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Failed to upload: ' + uploadError.message)
        return
      }

      const { data: { publicUrl } } = client.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await client
        .from('tell_users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) {
        console.error('Update error:', updateError)
        alert('Failed to update profile')
        return
      }

      setUser({ ...user, avatar_url: publicUrl })
      alert('Avatar uploaded successfully!')
    } catch (err) {
      console.error('Avatar upload error:', err)
      alert('Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function inviteUser() {
    const email = prompt('Enter email address to invite:')
    if (!email) return

    const client = getSupabaseClient()
    const session = await client?.auth.getSession()
    const token = session?.data.session?.access_token

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        email,
        inviterName: user?.display_name,
        inviterTell: user?.tell_number,
      }),
    })

    if (res.ok) {
      alert(`Invitation sent to ${email}`)
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to send invite')
    }
  }

  useEffect(() => {
    loadUserAndConnections()
  }, [])

  async function loadUserAndConnections() {
    const client = getSupabaseClient()
    if (!client) {
      router.push('/auth')
      return
    }

    const { data: { session } } = await client.auth.getSession()
    if (!session) {
      router.push('/auth')
      return
    }

    let { data: profile, error } = await client
      .from('tell_users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error || !profile) {
      const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'User'
      const { data: newProfile, error: createError } = await client
        .from('tell_users')
        .insert({
          id: session.user.id,
          email: session.user.email,
          display_name: displayName,
        })
        .select()
        .single()

      if (createError || !newProfile) {
        console.error('Failed to create tell_user', createError)
        setLoading(false)
        return
      }
      profile = newProfile
    }

    setUser(profile)

    if (profile?.tell_number) {
      const { data: conns } = await client
        .from('tell_connections')
        .select('*')
        .or(`initiator_tell.eq.${profile.tell_number},receiver_tell.eq.${profile.tell_number}`)
        .order('created_at', { ascending: false })
      
      const enriched = await Promise.all((conns || []).map(async (conn) => {
        const otherTell = conn.initiator_tell === profile.tell_number ? conn.receiver_tell : conn.initiator_tell
        const { data: otherUser } = await client
          .from('tell_users')
          .select('display_name, avatar_url')
          .eq('tell_number', otherTell)
          .single()
        return { ...conn, otherTell, otherName: otherUser?.display_name || otherTell, otherAvatar: otherUser?.avatar_url }
      }))
      setConnections(enriched)
    }
    setLoading(false)
  }

  async function handleSearchUser() {
    const client = getSupabaseClient()
    if (!client || !user) return

    if (!targetTell || targetTell.length !== 8) {
      alert('Please enter a valid 8‑character Tell‑number')
      return
    }

    const upperTell = targetTell.toUpperCase()
    if (upperTell === user.tell_number) {
      alert('You cannot add yourself')
      return
    }

    const existing = connections.find(c => c.otherTell === upperTell)
    if (existing) {
      setSelectedUser({ tell_number: upperTell, display_name: existing.otherName })
      setShowCallOptions(true)
      setTargetTell('')
      return
    }

    const { data: targetUser, error: findError } = await client
      .from('tell_users')
      .select('tell_number, display_name, avatar_url')
      .eq('tell_number', upperTell)
      .single()

    if (findError || !targetUser) {
      alert(`User with Tell‑number "${upperTell}" not found`)
      return
    }

    setSelectedUser({ tell_number: targetUser.tell_number, display_name: targetUser.display_name || targetUser.tell_number })
    setShowCallOptions(true)
    setTargetTell('')
  }

  async function startTextChat() {
    if (!selectedUser || !user) return
    const connectionId = await createOrGetConnection(selectedUser.tell_number)
    if (connectionId) {
      setSelectedConnection(connectionId)
      await loadMessages(connectionId)
    }
    setShowCallOptions(false)
    setSelectedUser(null)
  }

  async function startVoiceCall() {
    if (!selectedUser || !user) return
    const connectionId = await createOrGetConnection(selectedUser.tell_number)
    if (connectionId) {
      await startCall(connectionId, selectedUser.display_name, false)
    }
    setShowCallOptions(false)
    setSelectedUser(null)
  }

  async function startVideoCall() {
    if (!selectedUser || !user) return
    const connectionId = await createOrGetConnection(selectedUser.tell_number)
    if (connectionId) {
      await startCall(connectionId, selectedUser.display_name, true)
    }
    setShowCallOptions(false)
    setSelectedUser(null)
  }

  async function createOrGetConnection(targetTell: string): Promise<string | null> {
    const client = getSupabaseClient()
    if (!client || !user) return null

    const { data: existing } = await client
      .from('tell_connections')
      .select('id')
      .or(`and(initiator_tell.eq.${user.tell_number},receiver_tell.eq.${targetTell}),and(initiator_tell.eq.${targetTell},receiver_tell.eq.${user.tell_number})`)
      .maybeSingle()

    if (existing) {
      return existing.id
    }

    const { data: connection, error: createError } = await client
      .from('tell_connections')
      .insert({
        initiator_tell: user.tell_number,
        receiver_tell: targetTell,
        status: 'active'
      })
      .select()
      .single()

    if (createError) {
      console.error('Create connection error:', createError)
      alert('Could not establish connection')
      return null
    }

    const { data: otherUser } = await client
      .from('tell_users')
      .select('display_name, avatar_url')
      .eq('tell_number', targetTell)
      .single()

    const newConnection = {
      ...connection,
      otherTell: targetTell,
      otherName: otherUser?.display_name || targetTell,
      otherAvatar: otherUser?.avatar_url
    }
    setConnections(prev => [newConnection, ...prev])

    return connection.id
  }

  async function sendMessage(connectionId: string) {
    if (!messageInput.trim()) return
    const client = getSupabaseClient()
    if (!client || !user) return

    const newMessage = {
      id: crypto.randomUUID(),
      connection_id: connectionId,
      sender_tell: user.tell_number,
      message: messageInput,
      sent_at: new Date().toISOString()
    }

    await client.from('tell_messages').insert(newMessage)

    setMessages(prev => ({
      ...prev,
      [connectionId]: [...(prev[connectionId] || []), newMessage]
    }))
    setMessageInput('')
  }

  async function loadMessages(connectionId: string) {
    const client = getSupabaseClient()
    if (!client) return
    const { data } = await client
      .from('tell_messages')
      .select('*')
      .eq('connection_id', connectionId)
      .order('sent_at', { ascending: true })
    setMessages(prev => ({ ...prev, [connectionId]: data || [] }))
  }

  function selectConnection(conn: any) {
    setSelectedConnection(conn.id)
    setSelectedUser({ tell_number: conn.otherTell, display_name: conn.otherName })
    loadMessages(conn.id)
  }

  function copyTellNumber() {
    if (user?.tell_number) {
      navigator.clipboard.writeText(user.tell_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function clearSingleChat() {
    if (!selectedConnection) return
    const client = getSupabaseClient()
    if (!client) return
    const { error } = await client
      .from('tell_messages')
      .delete()
      .eq('connection_id', selectedConnection)
    if (error) {
      console.error('Clear chat error:', error)
      alert('Failed to clear chat')
    } else {
      setMessages(prev => ({ ...prev, [selectedConnection]: [] }))
      alert('Chat cleared successfully')
    }
    setShowClearModal(false)
  }

  async function clearAllChats() {
    const client = getSupabaseClient()
    if (!client) return
    const connectionIds = connections.map(c => c.id)
    if (connectionIds.length === 0) return
    const { error } = await client
      .from('tell_messages')
      .delete()
      .in('connection_id', connectionIds)
    if (error) {
      console.error('Clear all chats error:', error)
      alert('Failed to clear all chats')
    } else {
      setMessages({})
      alert('All chats cleared successfully')
    }
    setShowClearModal(false)
  }

  async function handleSignOut() {
    const client = getSupabaseClient()
    await client?.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E2A78]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] flex items-center justify-center p-6 overflow-hidden">
      <div className="w-full max-w-4xl neumorph-panel p-8 pt-16 pb-8 flex flex-col items-center">
        <CallListener />
        <IncomingCallBanner />

        {/* About Tell Modal */}
        {showAboutModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="neumorph-panel max-w-md w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">About Tell</h2>
                <button onClick={() => setShowAboutModal(false)} className="text-white/70 hover:text-white p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 text-[#F5F5F5]/80 text-sm leading-relaxed">
                <p className="text-base font-semibold text-[#1E2A78]">You are being watched.</p>
                <p>Every message, every call, every person you talk to. Someone is recording it.</p>
                <p>They know your politics. Your fears. Who you love. And they use it to control you.</p>
                <p className="text-base font-semibold text-[#E74C3C]">This is the silent prison.</p>
                <p>Tell breaks the chains. No servers listen. No databases store. No middlemen.</p>
                <p className="font-bold text-white">Your Tell-number. Your sovereignty.</p>
                <p className="text-center text-lg font-bold text-white my-3">"The truth shall set you free." — John 8:32</p>
                <p className="text-[#1E2A78] font-bold text-center text-xl">TELL – Speak freely. Fear nothing.</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6 w-full">
          <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-12 w-auto mx-auto mb-3" />
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-sm text-[#F5F5F5]/70">Your Tell‑number:</span>
            <code className="text-xl font-mono font-bold text-[#1E2A78]">{user?.tell_number}</code>
            <button onClick={copyTellNumber} className="text-white/50 hover:text-white">
              {copied ? <Check className="h-4 w-4 text-[#2ECC71]" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Action Buttons Row - Professional Gray */}
        <div className="flex flex-wrap gap-3 justify-center mb-6 w-full">
          <button onClick={inviteUser} className="neumorph-btn-primary px-6 py-2.5 text-sm font-medium">Invite</button>
          <button onClick={handleAvatarClick} className="neumorph-btn-primary px-6 py-2.5 text-sm font-medium">Profile</button>
          <button onClick={() => setShowAboutModal(true)} className="neumorph-btn-primary px-6 py-2.5 text-sm font-medium">About</button>
          <div className="relative">
            <button onClick={() => setShowRingtonePicker(!showRingtonePicker)} className="neumorph-btn-primary px-6 py-2.5 text-sm font-medium">Ringtone</button>
            {showRingtonePicker && (
              <div className="absolute top-full left-0 mt-2 neumorph-panel p-2 z-20 min-w-[140px]">
                {RINGTONES.map((ringtone) => (
                  <button
                    key={ringtone.name}
                    onClick={() => { setSelectedRingtone(ringtone.file); setShowRingtonePicker(false) }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedRingtone === ringtone.file ? 'bg-[#1E2A78]/30 text-[#1E2A78]' : 'text-white hover:bg-white/10'}`}
                  >
                    {ringtone.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleSignOut} className="neumorph-btn-danger px-6 py-2.5 text-sm font-medium">Sign Out</button>
        </div>

        {/* Search Section */}
        <div className="w-full mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={targetTell}
              onChange={(e) => setTargetTell(e.target.value.toUpperCase())}
              placeholder="Enter 8‑character Tell‑number"
              className="flex-1 rounded-xl text-base px-5 py-3"
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
            />
            <button onClick={handleSearchUser} className="neumorph-btn-primary px-6 py-3 text-sm font-medium">Find</button>
          </div>
        </div>

        {/* Toggle Contacts */}
        {connections.length > 0 && (
          <div className="flex justify-end w-full mb-3">
            <button onClick={() => setShowContacts(!showContacts)} className="text-white/50 hover:text-white text-xs flex items-center gap-1">
              {showContacts ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showContacts ? 'Hide Contacts' : 'Show Contacts'}
            </button>
          </div>
        )}

        {/* Call Options Modal */}
        {showCallOptions && selectedUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="neumorph-panel p-6 max-w-sm w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Connect with {selectedUser.display_name}</h3>
                <button onClick={() => setShowCallOptions(false)} className="text-white/70 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-[#F5F5F5]/70 mb-5">Tell‑number: <span className="text-[#1E2A78]">{selectedUser.tell_number}</span></p>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={startTextChat} className="neumorph-btn-primary flex flex-col items-center gap-2 py-3 text-xs">Text</button>
                <button onClick={startVoiceCall} className="neumorph-btn-primary flex flex-col items-center gap-2 py-3 text-xs">Voice</button>
                <button onClick={startVideoCall} className="neumorph-btn-primary flex flex-col items-center gap-2 py-3 text-xs">Video</button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Box with INNER SCROLL ONLY */}
        {selectedConnection && selectedUser && (
          <>
            <div className="w-full mb-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/20">
                <div>
                  <h2 className="text-base font-bold text-white">{selectedUser.display_name}</h2>
                  <p className="text-xs text-white/50">{selectedUser.tell_number}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowClearModal(true)} className="text-white/50 hover:text-[#E74C3C]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={startVoiceCall} className="text-white/50 hover:text-white">
                    <img src="/tell-icons/voice.png" alt="" className="h-4 w-4" />
                  </button>
                  <button onClick={startVideoCall} className="text-white/50 hover:text-white">
                    <img src="/tell-icons/video.png" alt="" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* INNER SCROLLABLE CHAT BOX */}
            <div ref={chatContainerRef} className="w-full h-[400px] overflow-y-auto rounded-xl bg-[#1a1a1a] p-4 mb-3 shadow-inner">
              {(messages[selectedConnection] || []).length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="h-8 w-8 text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/40">No messages yet</p>
                </div>
              ) : (
                (messages[selectedConnection] || []).map((msg, idx) => {
                  const isOwn = msg.sender_tell === user?.tell_number
                  return (
                    <div key={idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${isOwn ? 'bg-[#1E2A78] text-white' : 'bg-[#2C2C2C] text-white'}`}>
                        <p className="break-words">{msg.message}</p>
                        <p className="text-[9px] opacity-60 mt-0.5 text-right">
                          {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="w-full">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage(selectedConnection)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl text-sm px-4 py-2.5"
                />
                <button onClick={() => sendMessage(selectedConnection)} className="neumorph-btn-primary px-5 py-2.5">
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Welcome State */}
        {!selectedConnection && (
          <div className="text-center py-8">
            <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-16 w-auto mx-auto mb-4 opacity-80" />
            <h3 className="text-xl font-bold mb-2 text-white">Welcome to Tell</h3>
            <p className="text-sm text-white/60 mb-5">Enter a Tell‑number to start</p>
            <div className="neumorph-panel p-3 inline-block">
              <p className="text-xs text-white/50 mb-1">Your sovereign identifier</p>
              <code className="text-xl font-mono font-bold text-[#1E2A78]">{user?.tell_number}</code>
            </div>
          </div>
        )}

        {/* Contacts List */}
        {connections.length > 0 && showContacts && !selectedConnection && (
          <div className="w-full mt-4 p-4 bg-[#1a1a1a] rounded-xl">
            <h3 className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Your contacts</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => selectConnection(conn)}
                  className="w-full text-left p-2 rounded-lg hover:bg-white/10 transition flex items-center gap-2"
                >
                  {conn.otherAvatar ? (
                    <img src={conn.otherAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1E2A78] to-[#2ECC71] flex items-center justify-center text-xs font-bold text-white">
                      {conn.otherName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{conn.otherName}</div>
                    <div className="text-[10px] text-white/50">{conn.otherTell}</div>
                  </div>
                  {activeCall?.id === conn.id && (
                    <div className="text-xs text-[#2ECC71] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2ECC71] animate-pulse"></span> Live
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clear Chat Modal */}
        <ClearChatModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onClearSingle={clearSingleChat}
          onClearAll={clearAllChats}
          connectionName={selectedUser?.display_name}
        />
      </div>

      <CallPanel />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        if (e.target.files?.[0]) uploadAvatar(e.target.files[0])
      }} />
    </div>
  )
}