'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConceptCard } from '@/lib/types'
import { X } from 'lucide-react'
import { isGDriveUrl } from '@/lib/utils'

interface Props {
  onClose: () => void
  onCreated: (card: ConceptCard) => void
  userId: string | null
  sessionId?: string
}

export function NewCardModal({ onClose, onCreated, userId, sessionId }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [status, setStatus] = useState<'idea' | 'active' | 'done'>('idea')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    const supabase = createClient()
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const cover_image_type = coverUrl ? (isGDriveUrl(coverUrl) ? 'gdrive' : 'upload') : null

    const { data, error: dbErr } = await supabase
      .from('concept_cards')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        cover_image_url: coverUrl.trim() || null,
        cover_image_type,
        tags,
        status,
        session_id: sessionId ?? null,
        created_by: userId,
      })
      .select('*, card_images(*), card_comments(*)')
      .single()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onCreated(data as ConceptCard)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold">New Concept Card</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="e.g. Golden Hour Editorial"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description / Mood</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              placeholder="Describe the vibe, references, styling direction..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Cover Image URL</label>
            <input
              value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              type="url"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="https://... or Google Drive link"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Tags <span className="text-zinc-400 font-normal text-xs">(comma-separated)</span>
            </label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="outdoor, editorial, natural light"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="flex gap-2">
              {(['idea', 'active', 'done'] as const).map(s => (
                <label
                  key={s}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer capitalize transition-colors ${
                    status === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <input type="radio" className="sr-only" checked={status === s} onChange={() => setStatus(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border border-zinc-200 rounded-xl py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
