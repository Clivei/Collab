'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Submission, SubmissionStatus, Role } from '@/lib/types'
import { formatWALink, roleLabel, statusLabel, cn } from '@/lib/utils'
import { X, ExternalLink, MessageCircle } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  muse: 'bg-amber-100 text-amber-700',
  photographer: 'bg-blue-100 text-blue-700',
  stylist: 'bg-purple-100 text-purple-700',
  mua: 'bg-rose-100 text-rose-700',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-zinc-100 text-zinc-600',
  reviewing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

const ROLES: Role[] = ['muse', 'photographer', 'stylist', 'mua']
const STATUSES: SubmissionStatus[] = ['new', 'reviewing', 'approved', 'rejected', 'archived']

function startOfWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function DashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all')
  const [selected, setSelected] = useState<Submission | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('submissions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSubmissions(data as Submission[]); setLoading(false) })
  }, [])

  const filtered = useMemo(() => submissions.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    const q = search.toLowerCase()
    if (q && !s.full_name.toLowerCase().includes(q) && !s.wa_number.includes(q)) return false
    return true
  }), [submissions, roleFilter, statusFilter, search])

  const newThisWeek = submissions.filter(s => s.created_at >= startOfWeek()).length

  async function updateStatus(id: string, status: SubmissionStatus) {
    const supabase = createClient()
    await supabase.from('submissions').update({ status }).eq('id', id)
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Total', value: submissions.length },
          { label: 'New this week', value: newThisWeek },
          ...ROLES.map(r => ({ label: roleLabel(r), value: submissions.filter(s => s.role === r).length })),
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-zinc-100 p-4">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 w-full sm:w-64"
          placeholder="Search by name or WhatsApp..."
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as Role | 'all')} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as SubmissionStatus | 'all')} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white">
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-sm">No submissions found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setSelected(s)} className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium">{s.full_name}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[s.role])}>
                      {roleLabel(s.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <a href={formatWALink(s.wa_number)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors">
                      <MessageCircle className="w-3 h-3" /> {s.wa_number}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[s.status])}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">
                    {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ProfileDrawer submission={selected} onClose={() => setSelected(null)} onStatusChange={updateStatus} />
      )}
    </div>
  )
}

function ProfileDrawer({ submission, onClose, onStatusChange }: {
  submission: Submission
  onClose: () => void
  onStatusChange: (id: string, status: SubmissionStatus) => void
}) {
  const [notes, setNotes] = useState(submission.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const details = submission.details as Record<string, unknown>

  async function saveNotes() {
    setSavingNotes(true)
    const supabase = createClient()
    await supabase.from('submissions').update({ notes }).eq('id', submission.id)
    setSavingNotes(false)
  }

  function renderMedia(media: unknown) {
    if (!media || typeof media !== 'object') return null
    const m = media as { type: string; url: string }
    if (m.type === 'gdrive') {
      return <a href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-sm"><ExternalLink className="w-3 h-3" /> Open in Drive</a>
    }
    return <img src={m.url} alt="" className="max-w-full rounded-lg border border-zinc-100 max-h-48 object-cover" />
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{submission.full_name}</h2>
            <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[submission.role])}>
              {roleLabel(submission.role)}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Contact</h3>
            <a href={formatWALink(submission.wa_number)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900">
              <MessageCircle className="w-4 h-4 text-green-500" /> {submission.wa_number}
            </a>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Status</h3>
            <select
              value={submission.status}
              onChange={e => onStatusChange(submission.id, e.target.value as SubmissionStatus)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white w-full"
            >
              {(['new', 'reviewing', 'approved', 'rejected', 'archived'] as SubmissionStatus[]).map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              {Object.entries(details).map(([key, value]) => {
                if (key === 'face_media' || key === 'body_media' || key === 'portfolio_media') {
                  return (
                    <div key={key}>
                      <span className="font-medium capitalize text-zinc-500 text-xs">{key.replace(/_/g, ' ')}: </span>
                      {renderMedia(value)}
                    </div>
                  )
                }
                if (Array.isArray(value)) {
                  return value.length > 0 ? (
                    <div key={key}>
                      <span className="font-medium capitalize text-zinc-500 text-xs">{key.replace(/_/g, ' ')}: </span>
                      <span>{value.join(', ')}</span>
                    </div>
                  ) : null
                }
                if (typeof value === 'boolean') {
                  return (
                    <div key={key}>
                      <span className="font-medium capitalize text-zinc-500 text-xs">{key.replace(/_/g, ' ')}: </span>
                      <span>{value ? 'Yes' : 'No'}</span>
                    </div>
                  )
                }
                if (value !== null && value !== undefined && value !== '') {
                  return (
                    <div key={key}>
                      <span className="font-medium capitalize text-zinc-500 text-xs">{key.replace(/_/g, ' ')}: </span>
                      <span>{String(value)}</span>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Internal Notes</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              placeholder="Add notes visible only to the team..."
            />
            <button onClick={saveNotes} disabled={savingNotes} className="mt-2 text-xs bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          <div className="text-xs text-zinc-400">
            Submitted {new Date(submission.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  )
}
