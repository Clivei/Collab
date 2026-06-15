'use client'
import { UseFormReturn } from 'react-hook-form'
import type { MuaFormData } from '@/lib/validations'
import { MediaField } from './MediaField'

export function MuaFields({ form }: { form: UseFormReturn<MuaFormData> }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Makeup Specialty</label>
        <input {...form.register('specialty')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Natural, editorial, SFX..." />
      </div>
      <MediaField form={form as never} name={'portfolio_media' as never} label="Portfolio (optional)" />
    </div>
  )
}
