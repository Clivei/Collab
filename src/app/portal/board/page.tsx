'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConceptCard } from '@/lib/types'
import { ConceptCardGrid } from '@/components/board/ConceptCardGrid'

type StatusFilter = 'all' | 'idea' | 'active' | 'done'

export default function BoardPage() {
  const [cards, setCards] = useState<ConceptCard[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('Collaborator')
  const [userId, setUserId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserName((user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Collaborator')
      }
      const { data } = await supabase
        .from('concept_cards')
        .select('*, card_images(*), card_comments(*)')
        .order('created_at', { ascending: false })
      setCards((data ?? []) as ConceptCard[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? cards : cards.filter(c => c.status === filter)

  const opts: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'idea', label: 'Ideas' },
    { key: 'active', label: 'Active' },
    { key: 'done', label: 'Done' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Concept Board</h1>
          <p className="text-zinc-400 text-sm">Visual ideas, moods, and references for NoraPadel sessions.</p>
        </div>
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          {opts.map(o => (
            <button
              key={o.key}
              onClick={() => setFilter(o.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === o.key ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">Loading...</div>
      ) : (
        <ConceptCardGrid
          cards={filtered}
          onCardsChange={setCards}
          userName={userName}
          userId={userId}
        />
      )}
    </div>
  )
}
