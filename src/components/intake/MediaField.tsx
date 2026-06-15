'use client'
import { useState } from 'react'
import { UseFormReturn, FieldPath } from 'react-hook-form'
import { isGDriveUrl } from '@/lib/utils'

interface Props<T extends Record<string, unknown>> {
  form: UseFormReturn<T>
  name: FieldPath<T>
  label: string
  required?: boolean
}

export function MediaField<T extends Record<string, unknown>>({ form, name, label, required }: Props<T>) {
  const [mode, setMode] = useState<'upload' | 'gdrive'>('gdrive')
  const [gdriveValue, setGdriveValue] = useState('')
  const [gdriveError, setGdriveError] = useState('')

  function handleGdriveChange(val: string) {
    setGdriveValue(val)
    if (val && !isGDriveUrl(val)) {
      setGdriveError('Must be a Google Drive URL')
      form.setValue(name, undefined as never)
    } else {
      setGdriveError('')
      if (val) form.setValue(name, { type: 'gdrive', url: val } as never)
      else form.setValue(name, undefined as never)
    }
  }

  const error = form.formState.errors[name] as { message?: string } | undefined

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2 mb-2">
        {(['gdrive', 'upload'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === m ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
          >
            {m === 'gdrive' ? 'Google Drive link' : 'Upload file'}
          </button>
        ))}
      </div>
      {mode === 'gdrive' ? (
        <div>
          <input
            type="url"
            value={gdriveValue}
            onChange={(e) => handleGdriveChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="https://drive.google.com/file/d/..."
          />
          {gdriveError && <p className="text-xs text-red-500 mt-1">{gdriveError}</p>}
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*,video/*,.pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const objectUrl = URL.createObjectURL(file)
              form.setValue(name, { type: 'upload', url: objectUrl } as never)
            }}
            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:text-zinc-700 file:text-xs hover:file:bg-zinc-200"
          />
          <p className="text-xs text-zinc-400 mt-1">Images, video, or PDF up to 50MB</p>
        </div>
      )}
      {error?.message && <p className="text-xs text-red-500 mt-1">{error.message}</p>}
    </div>
  )
}
