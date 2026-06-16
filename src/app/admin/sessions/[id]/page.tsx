'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session, Role, Submission } from '@/lib/types'
import { roleLabel } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Check, Trash2 } from 'lucide-react'

const SLOTS: Role[] = ['muse', 'photographer', 'stylist', 'mua']
const STATUSES: Session['status'][] = ['idea', 'team_forming', 'team_set', 'scheduled', 'shoot_day', 'completed']
const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea', team_forming: 'Team Forming', team_set: 'Team Set',
  scheduled: 'Scheduled', shoot_day: 'Shoot Day', completed: 'Completed',
}

interface Member {
  id: string
  submission_id: string
  role: string
  full_name: string
}

export default function AdminSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [session, setSession] = useState<Session | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [talent, setTalent] = useState<Submission[]>([])
  const [chatExists, setChatExists] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // editable brief fields
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [moodBoard, setMoodBoard] = useState('')

  async function load() {
    const supabase = createClient()
    const { data: sess } = await supabase.from('sessions').select('*').eq('id', id).single()
    if (sess) {
      setSession(sess as Session)
      setNotes(sess.notes ?? '')
      setDate(sess.date ?? '')
      setLocation(sess.location ?? '')
      setMoodBoard(sess.mood_board_url ?? '')
    }

    const { data: mem } = await supabase
      .from('session_members')
      .select('id, submission_id, role, submissions(full_name)')
      .eq('session_id', id)
    if (mem) {
      setMembers(mem.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        submission_id: m.submission_id as string,
        role: m.role as string,
        full_name: ((m.submissions as { full_name?: string })?.full_name) ?? 'Unknown',
      })))
    }

    const { data: tal } = await supabase
      .from('submissions')
      .select('*')
      .order('full_name')
    if (tal) setTalent(tal as Submission[])

    const { data: chat } = await supabase.from('chats').select('id').eq('session_id', id).maybeSingle()
    setChatExists(!!chat)
  }

  useEffect(() => { load() }, [id])

  function memberForSlot(slot: Role) {
    return members.find(m => m.role === slot)
  }

  async function assign(slot: Role, submissionId: string) {
    const supabase = createClient()
    // remove existing for this slot first
    const existing = memberForSlot(slot)
    if (existing) {
      await supabase.from('session_members').delete().eq('id', existing.id)
    }
    if (submissionId) {
      await supabase.from('session_members').insert({
        session_id: id,
        submission_id: submissionId,
        role: slot,
      })
    }
    load()
  }

  async function updateStatus(status: Session['status']) {
    const supabase = createClient()
    await supabase.from('sessions').update({ status }).eq('id', id)
    setSession(prev => prev ? { ...prev, status } : prev)
    // Auto-create chat when team is set
    if (status === 'team_set' && !chatExists) {
      await supabase.from('chats').insert({ session_id: id })
      setChatExists(true)
    }
  }

  async function saveBrief() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('sessions').update({
      notes: notes.trim() || null,
      date: date || null,
      location: location.trim() || null,
      mood_board_url: moodBoard.trim() || null,
    }).eq('id', id)
    setSaving(false)
    setSavedMsg('Saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function createChat() {
    const supabase = createClient()
    await supabase.from('chats').insert({ session_id: id })
    setChatExists(true)
  }

  const filledSlots = SLOTS.filter(s => memberForSlot(s)).length

  if (!session) return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-zinc-400">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin/sessions" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 mb-6 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to sessions
      </Link>

      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <select
          value={session.status}
          onChange={e => updateStatus(e.target.value as Session['status'])}
          className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {/* Team slots */}
      <section className="bg-white rounded-2xl border border-zinc-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Team <span className="text-xs font-normal text-zinc-400">({filledSlots}/4 filled)</span></h2>
          {filledSlots === 4 && session.status !== 'team_set' && (
            <button onClick={() => updateStatus('team_set')} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
              <Check className="w-3 h-3" /> Mark Team Set & open chat
            </button>
          )}
        </div>
        <div className="space-y-3">
          {SLOTS.map(slot => {
            const current = memberForSlot(slot)
            const options = talent.filter(t => t.role === slot)
            return (
              <div key={slot} className="flex items-center gap-3">
                <span className="text-sm font-medium w-44 shrink-0">{roleLabel(slot)}</span>
                <select
                  value={current?.submission_id ?? ''}
                  onChange={e => assign(slot, e.target.value)}
                  className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">— Not assigned —</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}{o.status !== 'approved' ? ` (${o.status})` : ''}
                    </option>
                  ))}
                </select>
                {current && (
                  <button onClick={() => assign(slot, '')} className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Group chat */}
      <section className="bg-white rounded-2xl border border-zinc-100 p-6 mb-6">
        <h2 className="font-semibold mb-3">Group Chat</h2>
        {chatExists ? (
          <p className="text-sm text-green-600 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Group chat is active. Assigned collaborators can chat in their portal.</p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">No chat yet. It opens automatically when status is set to &ldquo;Team Set&rdquo;.</p>
            <button onClick={createChat} className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">Create now</button>
          </div>
        )}
      </section>

      {/* Brief */}
      <section className="bg-white rounded-2xl border border-zinc-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Brief &amp; Details</h2>
          <div className="flex items-center gap-3">
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
            <button onClick={saveBrief} disabled={saving} className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mood Board URL</label>
            <input value={moodBoard} onChange={e => setMoodBoard(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Brief / Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" placeholder="Concept, references, what to bring, call time..." />
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3">This brief is visible to assigned collaborators in their portal.</p>
      </section>
    </div>
  )
}
