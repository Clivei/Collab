'use client'
import { UseFormReturn } from 'react-hook-form'
import type { MuseFormData } from '@/lib/validations'
import { MediaField } from './MediaField'

const INTERESTS = ['dance', 'paint', 'music instruments', 'padel', 'badminton', 'basket', 'gymnastics']

export function MuseFields({ form, isMinor, age }: { form: UseFormReturn<MuseFormData>; isMinor: boolean; age: number | null }) {
  const interests = form.watch('interests') ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Height (cm) <span className="text-red-500">*</span></label>
          <input type="number" {...form.register('height')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="165" />
          {form.formState.errors.height && <p className="text-xs text-red-500 mt-1">{form.formState.errors.height.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Weight (kg) <span className="text-red-500">*</span></label>
          <input type="number" {...form.register('weight')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="55" />
          {form.formState.errors.weight && <p className="text-xs text-red-500 mt-1">{form.formState.errors.weight.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
        <input type="date" {...form.register('dob')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
        {age !== null && <p className="text-xs text-zinc-400 mt-1">Age: {age}</p>}
        {form.formState.errors.dob && <p className="text-xs text-red-500 mt-1">{form.formState.errors.dob.message}</p>}
        {isMinor && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 mb-2">You appear to be under 18. Our sessions involve photography with strangers — parental consent is required.</p>
            <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer">
              <input type="checkbox" {...form.register('age_confirmed')} />
              I confirm I am 18 or older (or have parental consent)
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{ name: 'ig' as const, label: 'Instagram', placeholder: '@handle' }, { name: 'tiktok' as const, label: 'TikTok', placeholder: '@handle' }, { name: 'threads' as const, label: 'Threads', placeholder: '@handle' }].map(f => (
          <div key={f.name}>
            <label className="block text-sm font-medium mb-1.5">{f.label}</label>
            <input {...form.register(f.name)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder={f.placeholder} />
          </div>
        ))}
      </div>

      <MediaField form={form as never} name={'face_media' as never} label="Face Photo" required />
      <MediaField form={form as never} name={'body_media' as never} label="Full-Body Photo (top to bottom)" required />

      <div>
        <label className="block text-sm font-medium mb-2">Other Interests</label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => {
            const checked = interests.includes(interest)
            return (
              <label key={interest} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${checked ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...interests, interest] : interests.filter(i => i !== interest)
                    form.setValue('interests', next)
                  }}
                />
                {interest}
              </label>
            )
          })}
        </div>
        <div className="mt-2">
          <input {...form.register('interest_other')} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Other interests (type here)" />
        </div>
      </div>
    </div>
  )
}
