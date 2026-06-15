'use client'
import { UseFormReturn } from 'react-hook-form'
import type { PhotographerFormData } from '@/lib/validations'
import { MediaField } from './MediaField'

const SETUPS = ['portrait', 'indoor', 'outdoor']

export function PhotographerFields({ form }: { form: UseFormReturn<PhotographerFormData> }) {
  const setups = form.watch('setups') ?? []

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Camera Model <span className="text-red-500">*</span></label>
        <input {...form.register('camera_model')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Sony A7IV, Canon R6, etc." />
        {form.formState.errors.camera_model && <p className="text-xs text-red-500 mt-1">{form.formState.errors.camera_model.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Lens</label>
        <input {...form.register('lens')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="35mm f/1.8, 85mm f/1.4, etc." />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Favorite Setup</label>
        <div className="flex gap-2">
          {SETUPS.map((s) => {
            const checked = setups.includes(s)
            return (
              <label key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors capitalize ${checked ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => {
                  const next = e.target.checked ? [...setups, s] : setups.filter(i => i !== s)
                  form.setValue('setups', next)
                }} />
                {s}
              </label>
            )
          })}
        </div>
      </div>
      <MediaField form={form as never} name={'portfolio_media' as never} label="Portfolio" required />
    </div>
  )
}
