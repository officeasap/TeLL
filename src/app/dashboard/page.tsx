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
    const audio = new Audio(selectedRingtone)
    audio.play().catch(() => {})
  }, [selectedRingtone])

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
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
        <Loader2 className="h-8 w-8 animate-spin text-[#13a1ff]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#121212] py-12 px-6 flex items-center justify-center">
      <CallListener />
      <IncomingCallBanner />

      {/* About Tell Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="neumorph-panel max-w-2xl w-full p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold font-['Oswald'] text-white">About Tell</h2>
              <button onClick={() => setShowAboutModal(false)} className="neumorph-icon p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 text-[#F5F5F5]/90 leading-relaxed">
              <p className="text-lg font-semibold text-[#13a1ff]">You are being watched. Every single day.</p>
              <p>Every message you type. Every call you make. Every person you talk to. Someone, somewhere, is recording it, analyzing it, and building a profile of who you are.</p>
              <p>They know your politics. They know your struggles. They know your fears. They know who you love and who you hate. And they use that knowledge – not to help you – but to control you.</p>
              <p className="text-lg font-semibold text-[#cd5126]">This is the silent prison of the digital age.</p>
              <p>For decades, we have been told that surveillance keeps us safe. That our data is in good hands. That we have nothing to fear if we have nothing to hide.</p>
              <p className="font-bold text-white">That is a lie.</p>
              <p>Surveillance is not about safety. It is about power. The power to silence dissent. The power to manipulate opinions. The power to turn every citizen into a suspect.</p>
              <p>Every time you use WhatsApp, Signal, Telegram, or any "free" service, you are feeding the machine. Your conversations are not private. Your metadata is sold. Your trust is betrayed.</p>
              <p className="text-xl font-bold text-[#13a1ff] text-center my-6">TELL IS THE BREAK.</p>
              <p>Tell has no servers that listen to your calls. No databases that store your messages forever. No corporate masters that sell your data to the highest bidder.</p>
              <p>When you talk on Tell, you talk directly to the person on the other end. Peer to peer. No middlemen. No eavesdroppers. No surveillance.</p>
              <p>Your Tell-number is your sovereign identity. No phone number. No email required. Just a unique code that only you control.</p>
              <p className="font-bold text-white">This is not just an app. This is a declaration of independence.</p>
              <p>We believe that the right to private communication is a God‑given right. Not a privilege granted by corporations. Not a temporary license from governments.</p>
              <p className="text-center text-xl font-bold text-white my-4">"The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction." — Proverbs 1:7</p>
              <p>Wake up. Take back your voice. Take back your freedom.</p>
              <p className="text-[#13a1ff] font-bold text-center text-2xl mt-4">TELL – Speak freely. Fear nothing.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Container - Centered with breathing space */}
      <div className="max-w-4xl w-full mx-auto">
        
        {/* Header Section */}
        <div className="neumorph-panel p-8 mb-8 w-full" style={{ borderRadius: '16px' }}>
          <div className="flex flex-col items-center text-center mb-6">
            <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-14 w-auto mb-3" />
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-sm text-[#F5F5F5]/70">Your Tell‑number:</span>
              <code className="text-xl font-mono font-bold text-[#13a1ff]">{user?.tell_number}</code>
              <button onClick={copyTellNumber} className="neumorph-icon p-1.5">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-[#F5F5F5]/70" />}
              </button>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={inviteUser} className="flex-1 neumorph-btn-primary flex items-center justify-center gap-2 py-3 text-base" style={{ background: '#13a1ff' }}>
              <Users className="h-4 w-4" /> Invite
            </button>
            <button onClick={handleSignOut} className="flex-1 neumorph-btn-primary flex items-center justify-center gap-2 py-3 text-base" style={{ background: '#cd5126' }}>
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="neumorph-panel p-6 mb-8 w-full flex items-center justify-between flex-wrap gap-4" style={{ borderRadius: '16px' }}>
          <div className="flex items-center gap-5">
            <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-[#13a1ff]" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1E2A78] to-[#13a1ff] flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className="font-medium text-white">Profile Picture</p>
              <p className="text-xs text-[#F5F5F5]/50 mt-0.5">Click to upload or change</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAboutModal(true)} className="neumorph-icon p-2.5 flex items-center gap-2">
              <Info className="h-4 w-4 text-[#13a1ff]" />
              <span className="text-xs font-medium text-white hidden sm:inline">About</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowRingtonePicker(!showRingtonePicker)} className="neumorph-icon p-2.5 flex items-center gap-2">
                <Music className="h-4 w-4 text-[#13a1ff]" />
                <span className="text-xs font-medium text-white hidden sm:inline">Ringtone</span>
              </button>
              {showRingtonePicker && (
                <div className="absolute right-0 top-full mt-2 neumorph-panel p-2 z-20 min-w-[160px]">
                  {RINGTONES.map((ringtone) => (
                    <button
                      key={ringtone.name}
                      onClick={() => { setSelectedRingtone(ringtone.file); setShowRingtonePicker(false) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selectedRingtone === ringtone.file ? 'bg-[#13a1ff]/20 text-[#13a1ff]' : 'hover:bg-[#13a1ff]/10 text-white'}`}
                    >
                      {ringtone.name}
                      {selectedRingtone === ringtone.file && <span className="float-right">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="neumorph-panel p-6 mb-8 w-full" style={{ borderRadius: '16px' }}>
          <h2 className="text-lg font-semibold mb-4 text-white">Start communicating</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={targetTell}
              onChange={(e) => setTargetTell(e.target.value.toUpperCase())}
              placeholder="Enter 8‑character Tell‑number"
              className="flex-1 rounded-xl text-base px-4 py-2.5"
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
            />
            <button onClick={handleSearchUser} className="neumorph-btn-primary flex items-center gap-2 px-6 py-2.5 text-base" style={{ background: '#13a1ff' }}>
              <Search className="h-4 w-4" /> Find
            </button>
          </div>
        </div>

        {/* Contact Toggle */}
        {connections.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button onClick={() => setShowContacts(!showContacts)} className="neumorph-icon flex items-center gap-2 px-3 py-1.5 text-xs">
              {showContacts ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showContacts ? 'Hide Contacts' : 'Show Contacts'}
            </button>
          </div>
        )}

        {/* Call Options Modal */}
        {showCallOptions && selectedUser && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="neumorph-panel p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Connect with {selectedUser.display_name}</h3>
                <button onClick={() => setShowCallOptions(false)} className="neumorph-icon p-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-[#F5F5F5]/70 mb-6">Tell‑number: <code className="text-[#13a1ff]">{selectedUser.tell_number}</code></p>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={startTextChat} className="neumorph-btn-primary flex flex-col items-center gap-2 py-3 text-sm" style={{ background: '#13a1ff' }}>
                  <MessageSquare className="h-6 w-6" />
                  <span>Text</span>
                </button>
                <button onClick={startVoiceCall} className="neumorph-btn-primary flex flex-col items-center gap-2 py-3 text-sm" style={{ background: '#13a1ff' }}>
                  <img src="/tell-icons/voice.png" alt="Voice" className="h-6 w-6" />
                  <span>Voice</span>
                </button>
                <button onClick={startVideoCall} className="neumorph-btn-primary flex flex-col items-center gap-2 py-3 text-sm" style={{ background: '#13a1ff' }}>
                  <img src="/tell-icons/video.png" alt="Video" className="h-6 w-6" />
                  <span>Video</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat View */}
        {selectedConnection && selectedUser && (
          <div className="neumorph-panel flex flex-col h-[500px] overflow-hidden mb-8 w-full" style={{ borderRadius: '16px' }}>
            <div className="p-4 border-b border-[#13a1ff]/20 bg-[#121212]">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedUser.display_name}</h2>
                  <p className="text-xs text-[#F5F5F5]/60 mt-0.5">{selectedUser.tell_number}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowClearModal(true)} className="neumorph-icon p-2" title="Clear chat history">
                    <Trash2 className="h-4 w-4 text-[#cd5126]" />
                  </button>
                  <button onClick={startVoiceCall} className="neumorph-icon p-2" title="Voice call">
                    <img src="/tell-icons/voice.png" alt="Voice" className="h-4 w-4" />
                  </button>
                  <button onClick={startVideoCall} className="neumorph-icon p-2" title="Video call">
                    <img src="/tell-icons/video.png" alt="Video" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-3">
              {(messages[selectedConnection] || []).length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="h-10 w-10 text-[#13a1ff]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#F5F5F5]/50">No messages yet</p>
                </div>
              ) : (
                (messages[selectedConnection] || []).map((msg, idx) => {
                  const isOwn = msg.sender_tell === user?.tell_number
                  return (
                    <div key={idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isOwn ? 'bg-[#13a1ff] text-white' : 'bg-[#2C2C2C] text-white'}`}>
                        <p className="break-words">{msg.message}</p>
                        <p className="text-[9px] opacity-60 mt-1 text-right">
                          {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-[#13a1ff]/20 bg-[#121212]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage(selectedConnection)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl text-sm px-4 py-2.5"
                />
                <button onClick={() => sendMessage(selectedConnection)} className="neumorph-btn-primary px-4 py-2.5" style={{ background: '#13a1ff' }}>
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Welcome State */}
        {!selectedConnection && (
          <div className="neumorph-panel p-10 text-center w-full" style={{ borderRadius: '16px' }}>
            <img src="/tell-icons/tell-logo.png" alt="Tell" className="h-20 w-auto mx-auto mb-5 opacity-80" />
            <h3 className="text-2xl font-bold mb-3 text-white">Welcome to Tell</h3>
            <p className="text-base text-[#F5F5F5]/60 mb-6">Enter a Tell‑number to start communicating securely</p>
            <div className="neumorph-panel p-4 inline-block mx-auto">
              <p className="text-xs text-[#F5F5F5]/60 mb-1">Your sovereign identifier</p>
              <code className="text-2xl font-mono font-bold text-[#13a1ff]">{user?.tell_number}</code>
            </div>
          </div>
        )}

        {/* Contact List */}
        {connections.length > 0 && showContacts && !selectedConnection && (
          <div className="neumorph-panel mt-6 p-5 w-full" style={{ borderRadius: '16px' }}>
            <h3 className="text-sm font-semibold text-[#F5F5F5]/60 mb-3 uppercase tracking-wider">Your contacts</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => selectConnection(conn)}
                  className="w-full text-left p-3 rounded-xl hover:bg-[#13a1ff]/10 transition-all flex items-center gap-3"
                >
                  {conn.otherAvatar ? (
                    <img src={conn.otherAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1E2A78] to-[#13a1ff] flex items-center justify-center text-sm font-bold text-white">
                      {conn.otherName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">{conn.otherName}</div>
                    <div className="text-xs text-[#F5F5F5]/50 mt-0.5">{conn.otherTell}</div>
                  </div>
                  {activeCall?.id === conn.id && (
                    <div className="text-xs text-[#13a1ff] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#13a1ff] animate-pulse"></span> Live
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ClearChatModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onClearSingle={clearSingleChat}
        onClearAll={clearAllChats}
        connectionName={selectedUser?.display_name}
      />

      <CallPanel />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        if (e.target.files?.[0]) uploadAvatar(e.target.files[0])
      }} />
    </div>
  )
}