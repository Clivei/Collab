'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface SessionRow {
  id: string
  title: string
  date?: string
  location?: string
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-zinc-100 text-zinc-500',
  team_forming: 'bg-amber-100 text-amber-700',
  team_set: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  shoot_day: 'bg-green-100 text-green-700',
  completed: 'bg-zinc-100 text-zinc-400',
}

const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea',
  team_forming: 'Team Forming',
  team_set: 'Team Set',
  scheduled: 'Scheduled',
  shoot_day: 'Shoot Day',
  completed: 'Completed',
}

export default function PortalPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: submission } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!submission) {
        setLinked(false)
        setLoading(false)
        return
      }

      const { data: members } = await supabase
        .from('session_members')
        .select('sessions(*)')
        .eq('submission_id', submission.id)

      if (members) {
        setSessions(
          members
            .map((m: Record<string, unknown>) => m.sessions as SessionRow)
            .filter(Boolean)
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">My Projects</h1>
        <p className="text-zinc-400 text-sm">Sessions you&apos;re part of.</p>
      </div>

      {!linked && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-6">
          <p className="text-sm text-amber-700 font-medium mb-1">Account not linked to a submission</p>
          <p className="text-xs text-amber-600">
            Make sure the email you signed up with matches the one on your collaborator application, or contact the NoraPadel team.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-400">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <p className="text-zinc-400 text-sm mb-1">No sessions assigned yet.</p>
          <p className="text-zinc-300 text-xs">Once the NoraPadel team adds you to a shoot, it will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map(s => (
            <Link
              key={s.id}
              href={`/portal/sessions/${s.id}`}
              className="block bg-white rounded-2xl border border-zinc-100 p-6 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-semibold">{s.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              {s.date && (
                <p className="text-xs text-zinc-400">
                  {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {s.location && <p className="text-xs text-zinc-400">{s.location}</p>}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/portal/board" className="text-sm text-amber-600 hover:underline">
          → Browse the full concept board
        </Link>
      </div>
    </div>
  )
}
