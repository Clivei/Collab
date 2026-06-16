'use client'
import { useState } from 'react'
import type { ConceptCard, CardComment, CardImage } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { X, Send, Plus, ExternalLink } from 'lucide-react'
import { isGDriveUrl } from '@/lib/utils'

interface Props {
  card: ConceptCard
  onClose: () => void
  onUpdate: (card: ConceptCard) => void
  isAdmin?: boolean
  userName: string
  userId: string | null
}

export function CardModal({ card, onClose, onUpdate, isAdmin, userName, userId }: Props) {
  const [comment, setComment] = useState('')
  const [addingImage, setAddingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [addingImg, setAddingImg] = useState(false)

  async function postComment() {
    if (!comment.trim() || submitting) return
    setSubmitting(true)
    const supabase = createClient()
    const { data } = await supabase.from('card_comments').insert({
      card_id: card.id,
      user_id: userId,
      author_name: userName,
      content: comment.trim(),
    }).select().single()
    if (data) {
      onUpdate({ ...card, card_comments: [...(card.card_comments ?? []), data as CardComment] })
      setComment('')
    }
    setSubmitting(false)
  }

  async function addImage() {
    if (!imageUrl.trim() || addingImg) return
    setAddingImg(true)
    const type = isGDriveUrl(imageUrl) ? 'gdrive' : 'upload'
    const supabase = createClient()
    const { data } = await supabase.from('card_images').insert({
      card_id: card.id,
      url: imageUrl.trim(),
      type,
      caption: imageCaption.trim() || null,
      uploaded_by: userId,
    }).select().single()
    if (data) {
      onUpdate({ ...card, card_images: [...(card.card_images ?? []), data as CardImage] })
      setImageUrl('')
      setImageCaption('')
      setAddingImage(false)
    }
    setAddingImg(false)
  }

  async function updateStatus(status: ConceptCard['status']) {
    const supabase = createClient()
    await supabase.from('concept_cards').update({ status }).eq('id', card.id)
    onUpdate({ ...card, status })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {card.cover_image_url && card.cover_image_type !== 'gdrive' && (
          <img src={card.cover_image_url} alt={card.title} className="w-full h-64 object-cover rounded-t-2xl" />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">{card.title}</h2>
              <div className="flex items-center flex-wrap gap-2">
                {isAdmin ? (
                  <select
                    value={card.status}
                    onChange={e => updateStatus(e.target.value as ConceptCard['status'])}
                    className="text-xs border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none bg-white"
                  >
                    <option value="idea">idea</option>
                    <option value="active">active</option>
                    <option value="done">done</option>
                  </select>
                ) : (
                  <span className="text-xs text-zinc-400 capitalize">{card.status}</span>
                )}
                {card.tags.map(tag => (
                  <span key={tag} className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-full text-zinc-500">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {card.description && (
            <p className="text-sm text-zinc-600 mb-6 leading-relaxed whitespace-pre-wrap">{card.description}</p>
          )}

          {/* Image Gallery */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Images</h3>
              <button
                onClick={() => setAddingImage(!addingImage)}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add image
              </button>
            </div>

            {addingImage && (
              <div className="bg-zinc-50 rounded-xl p-4 mb-3 space-y-2">
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  placeholder="Image URL or Google Drive link"
                />
                <input
                  value={imageCaption}
                  onChange={e => setImageCaption(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  placeholder="Caption (optional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addImage}
                    disabled={addingImg}
                    className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingImage(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(card.card_images?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {card.card_images!.map(img => (
                  <div key={img.id}>
                    {img.type === 'gdrive' ? (
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 p-3 bg-zinc-50 rounded-xl text-xs text-blue-600 hover:bg-zinc-100 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Drive link
                      </a>
                    ) : (
                      <img src={img.url} alt={img.caption ?? ''} className="w-full h-28 object-cover rounded-xl" />
                    )}
                    {img.caption && <p className="text-xs text-zinc-400 mt-1 truncate">{img.caption}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No images yet. Add inspiration, references, or moodboard shots.</p>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Comments</h3>
            <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
              {(card.card_comments ?? []).map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium shrink-0">
                    {c.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium">{c.author_name}</span>
                      <span className="text-xs text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              {(card.card_comments?.length ?? 0) === 0 && (
                <p className="text-xs text-zinc-400">No comments yet. Share your thoughts on this concept.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                placeholder="Add a comment..."
              />
              <button
                onClick={postComment}
                disabled={submitting}
                className="w-9 h-9 bg-zinc-900 text-white rounded-xl flex items-center justify-center hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
