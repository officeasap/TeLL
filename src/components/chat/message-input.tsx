'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { SendHorizonal, Paperclip, Bold, Italic, Code, CodeSquare } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/app-store'
import type { Profile } from '@/types/database'

interface MessageInputProps {
  channelId?: string
  channelName: string
  onSend: (content: string, attachments?: string[]) => Promise<void>
  placeholder?: string
}

function htmlToContent(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''

    const el = node as HTMLElement
    const tag = el.tagName?.toLowerCase()
    const children = Array.from(el.childNodes).map(walk).join('')

    switch (tag) {
      case 'strong':
      case 'b':
        return `**${children}**`
      case 'em':
      case 'i':
        return `_${children}_`
      case 'code':
        if (el.parentElement?.tagName?.toLowerCase() === 'pre') return children
        return `\`${children}\``
      case 'pre':
        return `\`\`\`\n${children}\n\`\`\``
      case 'p':
        return children + '\n'
      case 'br':
        return '\n'
      case 'span':
        if (el.dataset.type === 'mention') {
          return `@${el.dataset.id || children}`
        }
        return children
      default:
        return children
    }
  }

  return walk(div).replace(/\n+$/, '').trim()
}

export function MessageInput({ channelId, channelName, onSend, placeholder }: MessageInputProps) {
  const { workspace } = useAppStore()
  const [sending, setSending] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const membersRef = useRef<Profile[]>([])

  useEffect(() => {
    membersRef.current = members
  }, [members])

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client || !workspace) return

    async function loadMembers() {
      if (channelId) {
        const { data } = await client!
          .from('channel_members')
          .select('profile:profiles(*)')
          .eq('channel_id', channelId)

        if (data && data.length > 0) {
          const profiles = data
            .map((d: Record<string, unknown>) => d.profile as Profile)
            .filter(Boolean)
          setMembers(profiles)
          return
        }
      }

      const { data } = await client!
        .from('workspace_members')
        .select('profile:profiles(*)')
        .eq('workspace_id', workspace!.id)

      if (data) {
        const profiles = data
          .map((d: Record<string, unknown>) => d.profile as Profile)
          .filter(Boolean)
        setMembers(profiles)
      }
    }

    loadMembers()
  }, [workspace, channelId])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || `Message #${channelName}`,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            return membersRef.current
              .filter((m) =>
                m.display_name?.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 8)
          },
          render: () => {
            let popup: HTMLDivElement | null = null
            let selectedIndex = 0
            let items: Profile[] = []
            let command: any = null

            function escapeHtml(str: string): string {
              return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
            }

            function updatePopup() {
              if (!popup) return
              popup.innerHTML = items
                .map(
                  (item, i) => {
                    const safeName = escapeHtml(item.display_name || '')
                    const initial = escapeHtml(item.display_name?.[0]?.toUpperCase() || '?')
                    return `<button class="mention-item ${i === selectedIndex ? 'is-selected' : ''}" data-index="${i}">
                      <span class="mention-avatar">${initial}</span>
                      <span>${safeName}</span>
                    </button>`
                  }
                )
                .join('')

              popup.querySelectorAll('.mention-item').forEach((btn) => {
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault()
                  const idx = parseInt((btn as HTMLElement).dataset.index || '0')
                  const item = items[idx]
                  if (item && command) {
                    command({ id: item.id, label: item.display_name })
                  }
                })
              })
            }

            return {
              onStart: (props: any) => {
                items = props.items
                command = props.command
                selectedIndex = 0

                popup = document.createElement('div')
                popup.className = 'mention-popup'
                document.body.appendChild(popup)

                updatePopup()

                if (props.clientRect) {
                  const rect = props.clientRect?.()
                  if (rect && popup) {
                    popup.style.left = `${rect.left}px`
                    popup.style.top = `${rect.top - popup.offsetHeight - 8}px`
                  }
                }
              },
              onUpdate: (props: any) => {
                items = props.items
                selectedIndex = 0
                updatePopup()

                if (props.clientRect && popup) {
                  const rect = props.clientRect?.()
                  if (rect) {
                    popup.style.left = `${rect.left}px`
                    popup.style.top = `${rect.top - popup.offsetHeight - 8}px`
                  }
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + items.length) % items.length
                  updatePopup()
                  return true
                }
                if (props.event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % items.length
                  updatePopup()
                  return true
                }
                if (props.event.key === 'Enter') {
                  const item = items[selectedIndex]
                  if (item && command) {
                    command({ id: item.id, label: item.display_name })
                  }
                  return true
                }
                return false
              },
              onExit: () => {
                if (popup) {
                  popup.remove()
                  popup = null
                }
              },
            }
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          const mentionPopup = document.querySelector('.mention-popup')
          if (mentionPopup) return false
          event.preventDefault()
          handleSend()
          return true
        }
        return false
      },
    },
    content: '',
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor) {
      editor.extensionManager.extensions
        .filter((ext) => ext.name === 'placeholder')
        .forEach((ext) => {
          (ext.options as { placeholder: string }).placeholder = placeholder || `Message #${channelName}`
          editor.view.dispatch(editor.state.tr)
        })
    }
  }, [channelName, placeholder, editor])

  const handleSend = useCallback(async () => {
    if (!editor || sending) return

    const html = editor.getHTML()
    const content = htmlToContent(html)
    if (!content.trim() && attachments.length === 0) return

    let finalContent = content
    if (attachments.length > 0) {
      const fileLines = attachments.map((a) => `📎 [${a.name}](${a.url})`).join('\n')
      finalContent = finalContent ? `${finalContent}\n${fileLines}` : fileLines
    }

    setSending(true)
    try {
      await onSend(finalContent)
      editor.commands.clearContent()
      setAttachments([])
    } finally {
      setSending(false)
      editor.commands.focus()
    }
  }, [editor, sending, onSend, attachments])

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true)
    const newAttachments: { name: string; url: string }[] = []

    const client = getSupabaseClient()
    const session = client ? (await client.auth.getSession()).data.session : null

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split('.').pop()
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const path = `uploads/${safeName}`

        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'attachments')
        formData.append('path', path)

        const headers: Record<string, string> = {}
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }

        const res = await fetch('/api/upload', { method: 'POST', body: formData, headers })
        const data = await res.json()

        if (!res.ok || !data.publicUrl) {
          throw new Error(data.error || 'Upload failed')
        }

        newAttachments.push({ name: file.name, url: data.publicUrl })
      } catch (err) {
        console.error('Failed to upload file:', err)
        alert(`File upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments])
    setUploading(false)
  }

  const dragCounterRef = useRef(0)

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  const isEmpty = !editor?.getText().trim() && attachments.length === 0

  return (
    <div className="px-5 pb-4 pt-2">
      <div
        className={`rounded-2xl transition-all ${
          isDragging ? 'border-2 border-[#1E2A78] bg-[#1E2A78]/10' : 'border border-[#1E2A78]/20 shadow-sm'
        }`}
        style={{ background: isDragging ? undefined : '#2C2C2C' }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="px-4 py-6 text-center text-sm font-medium text-[#1E2A78]">
            Drop files here to upload
          </div>
        )}

        {!isDragging && (
          <>
            <div className="px-4 pt-3 pb-1">
              <EditorContent editor={editor} />
            </div>

            {attachments.length > 0 && (
              <div className="px-4 pb-1 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#1E2A78]/20 text-[#F5F5F5]"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{a.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="hover:text-[#E74C3C] ml-1 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-2 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <button
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                    editor?.isActive('bold')
                      ? 'text-[#1E2A78] bg-[#1E2A78]/20'
                      : 'text-[#F5F5F5]/60 hover:text-[#F5F5F5] hover:bg-[#1E2A78]/20'
                  }`}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                    editor?.isActive('italic')
                      ? 'text-[#1E2A78] bg-[#1E2A78]/20'
                      : 'text-[#F5F5F5]/60 hover:text-[#F5F5F5] hover:bg-[#1E2A78]/20'
                  }`}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                    editor?.isActive('code')
                      ? 'text-[#1E2A78] bg-[#1E2A78]/20'
                      : 'text-[#F5F5F5]/60 hover:text-[#F5F5F5] hover:bg-[#1E2A78]/20'
                  }`}
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                  title="Inline code"
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                    editor?.isActive('codeBlock')
                      ? 'text-[#1E2A78] bg-[#1E2A78]/20'
                      : 'text-[#F5F5F5]/60 hover:text-[#F5F5F5] hover:bg-[#1E2A78]/20'
                  }`}
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                  title="Code block"
                >
                  <CodeSquare className="h-4 w-4" />
                </button>
                <div className="w-px h-4 mx-1 bg-[#F5F5F5]/20" />
                <button
                  className="h-7 w-7 rounded-lg flex items-center justify-center transition-all text-[#F5F5F5]/60 hover:text-[#F5F5F5] hover:bg-[#1E2A78]/20"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  disabled={uploading}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </div>
              <button
                className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                  isEmpty || sending
                    ? 'bg-[#1E2A78]/40 cursor-not-allowed'
                    : 'bg-[#1E2A78] text-white hover:bg-[#2ECC71] shadow-sm'
                }`}
                disabled={isEmpty || sending}
                onClick={handleSend}
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}