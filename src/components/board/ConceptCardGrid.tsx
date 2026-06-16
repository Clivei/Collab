'use client'
import { useState } from 'react'
import type { ConceptCard } from '@/lib/types'
import { CardModal } from './CardModal'
import { ImageIcon } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-zinc-100 text-zinc-500',
  active: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
}

interface Props {
  cards: ConceptCard[]
  onCardsChange: (cards: ConceptCard[]) => void
  sessionId?: string
  isAdmin?: boolean
  userName: string
  userId: string | null
}

export function ConceptCardGrid({ cards, onCardsChange, sessionId, isAdmin, userName, userId }: Props) {
  const [selected, setSelected] = useState<ConceptCard | null>(null)

  function handleCardUpdate(updated: ConceptCard) {
    onCardsChange(cards.map(c => c.id === updated.id ? updated : c))
    setSelected(updated)
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <ImageIcon className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
        <p className="text-sm">No concept cards yet.</p>
        {isAdmin && <p className="text-xs text-zinc-300 mt-1">Click &ldquo;New Concept&rdquo; to create the first one.</p>}
      </div>
    )
  }

  return (
    <>
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {cards.map(card => (
          <div
            key={card.id}
            onClick={() => setSelected(card)}
            className="break-inside-avoid bg-white rounded-2xl border border-zinc-100 overflow-hidden cursor-pointer hover:border-zinc-300 hover:shadow-md transition-all group"
          >
            {card.cover_image_url ? (
              card.cover_image_type === 'gdrive' ? (
                <div className="w-full h-44 bg-zinc-100 flex items-center justify-center">
                  <span className="text-xs text-zinc-400">Google Drive image</span>
                </div>
              ) : (
                <img
                  src={card.cover_image_url}
                  alt={card.title}
                  className="w-full object-cover max-h-72 group-hover:scale-[1.01] transition-transform duration-300"
                />
              )
            ) : (
              <div className="w-full h-36 bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-zinc-200" />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-semibold text-sm leading-snug">{card.title}</h3>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[card.status]}`}>
                  {card.status}
                </span>
              </div>
              {card.description && (
                <p className="text-xs text-zinc-500 line-clamp-3 mb-2">{card.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                {(card.card_images?.length ?? 0) > 0 && (
                  <span>{card.card_images!.length} image{card.card_images!.length !== 1 ? 's' : ''}</span>
                )}
                {(card.card_comments?.length ?? 0) > 0 && (
                  <span>{card.card_comments!.length} comment{card.card_comments!.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              {card.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {card.tags.map(tag => (
                    <span key={tag} className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-full text-zinc-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <CardModal
          card={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleCardUpdate}
          isAdmin={isAdmin}
          userName={userName}
          userId={userId}
        />
      )}
    </>
  )
}
