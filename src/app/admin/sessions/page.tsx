'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session } from '@/lib/types'
import Link from 'next/link'
import { Plus, X, Calendar, MapPin, Users } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-zinc-100 text-zinc-500',
  team_forming: 'bg-amber-100 text-amber-700',
  team_set: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  shoot_day: 'bg-green-100 text-green-700',
  completed: 'bg-zinc-100 text-zinc-400',
}
const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea', team_forming: 'Team Forming', team_set: 'Team Set',
  scheduled: 'Scheduled', shoot_day: 'Shoot Day', completed: 'Completed',
}

interface SessionWithCount extends Session {
  memberCount?: number
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<SessionWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('sessions')
      .select('*, session_members(id)')
      .order('created_at', { ascending: false })
    if (data) {
      setSessions(data.map((s: Record<string, unknown>) => ({
        ...(s as unknown as Session),
        memberCount: ((s.session_members as unknown[]) ?? []).length,
      })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Sessions</h1>
          <p className="text-zinc-400 text-sm">Plan shoots, assemble teams, and open group chats.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Session
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <p className="text-zinc-400 text-sm mb-1">No sessions yet.</p>
          <p className="text-zinc-300 text-xs">Create your first session to start building a team.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map(s => (
            <Link
              key={s.id}
              href={`/admin/sessions/${s.id}`}
              className="block bg-white rounded-2xl border border-zinc-100 p-6 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-semibold">{s.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              <div className="space-y-1 text-xs text-zinc-400">
                {s.date && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                {s.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {s.location}</div>}
                <div className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {s.memberCount ?? 0} / 4 team slots filled</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <NewSessionModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}

function NewSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('sessions').insert({
      title: title.trim(),
      date: date || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold">New Session</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title <span className="text-red-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="e.g. Sunset Rooftop Editorial" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Surabaya" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Brief / Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" placeholder="Concept, references, what to bring..." />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-zinc-200 rounded-xl py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button onClick={create} disabled={saving} className="flex-1 bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">{saving ? 'Creating...' : 'Create Session'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
