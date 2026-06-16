'use client'
import { useEffect, useState, useRef } from 'react'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConceptCard, Message } from '@/lib/types'
import { ConceptCardGrid } from '@/components/board/ConceptCardGrid'
import { Send, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tab, setTab] = useState<'brief' | 'board' | 'chat'>('brief')
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [cards, setCards] = useState<ConceptCard[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [msgInput, setMsgInput] = useState('')
  const [userName, setUserName] = useState('Collaborator')
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserName((user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Collaborator')
      }

      const { data: sess } = await supabase.from('sessions').select('*').eq('id', id).single()
      setSession(sess)

      const { data: cardData } = await supabase
        .from('concept_cards')
        .select('*, card_images(*), card_comments(*)')
        .eq('session_id', id)
        .order('created_at', { ascending: false })
      setCards((cardData ?? []) as ConceptCard[])

      const { data: chat } = await supabase
        .from('chats')
        .select('id')
        .eq('session_id', id)
        .maybeSingle()

      if (chat) {
        setChatId(chat.id)
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at')
        setMessages((msgs ?? []) as Message[])
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (!chatId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message])
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chatId])

  useEffect(() => {
    if (tab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, tab])

  async function sendMessage() {
    if (!msgInput.trim() || !chatId) return
    const supabase = createClient()
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      sender_name: userName,
      body: msgInput.trim(),
    })
    setMsgInput('')
  }

  const tabs = [
    { key: 'brief' as const, label: 'Brief' },
    { key: 'board' as const, label: 'Concept Board' },
    { key: 'chat' as const, label: 'Chat' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/portal"
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 mb-6 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </Link>

      {session && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{String(session.title ?? '')}</h1>
          {session.date ? (
            <p className="text-sm text-zinc-400 mt-1">
              {new Date(String(session.date)).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          ) : null}
          {session.location ? <p className="text-sm text-zinc-400">{String(session.location)}</p> : null}
        </div>
      )}

      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'brief' && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-6">
          {session?.notes ? (
            <div>
              <h2 className="font-semibold mb-3">Session Notes</h2>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{String(session.notes)}</p>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">No brief added yet. The team will update this with shoot details.</p>
          )}
          {session?.mood_board_url ? (
            <a
              href={String(session.mood_board_url)}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-4 text-sm text-amber-600 hover:underline"
            >
              → View Mood Board
            </a>
          ) : null}
        </div>
      )}

      {tab === 'board' && (
        <ConceptCardGrid
          cards={cards}
          onCardsChange={setCards}
          sessionId={id}
          userName={userName}
          userId={userId}
        />
      )}

      {tab === 'chat' && (
        <div className="bg-white rounded-2xl border border-zinc-100 flex flex-col h-[60vh]">
          {!chatId ? (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm p-6 text-center">
              Chat will be available once a team is assigned to this session.
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.sender_id === userId ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-zinc-400 mb-1">{m.sender_name}</span>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      m.sender_id === userId ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
                    }`}>
                      {m.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-zinc-100 p-3 flex gap-2">
                <input
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendMessage}
                  className="w-9 h-9 bg-zinc-900 text-white rounded-xl flex items-center justify-center hover:bg-zinc-800 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
