'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConceptCard } from '@/lib/types'
import { ConceptCardGrid } from '@/components/board/ConceptCardGrid'
import { NewCardModal } from '@/components/board/NewCardModal'
import { Plus } from 'lucide-react'

export default function AdminBoardPage() {
  const [cards, setCards] = useState<ConceptCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data } = await supabase
        .from('concept_cards')
        .select('*, card_images(*), card_comments(*)')
        .order('created_at', { ascending: false })
      setCards((data ?? []) as ConceptCard[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Concept Board</h1>
          <p className="text-zinc-400 text-sm">Create and manage visual concepts for sessions.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Concept
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">Loading...</div>
      ) : (
        <ConceptCardGrid
          cards={cards}
          onCardsChange={setCards}
          isAdmin
          userName="Admin"
          userId={userId}
        />
      )}

      {showNew && (
        <NewCardModal
          onClose={() => setShowNew(false)}
          onCreated={(card) => { setCards(prev => [card, ...prev]); setShowNew(false) }}
          userId={userId}
        />
      )}
    </div>
  )
}
