'use client'
import { UseFormReturn } from 'react-hook-form'
import type { StylistFormData } from '@/lib/validations'

export function StylistFields({ form }: { form: UseFormReturn<StylistFormData> }) {
  const rentable = form.watch('rentable_clothing')

  return (
    <div className="space-y-4">
      {([
        { name: 'can_coordinate' as const, label: 'Can you coordinate collabs?' },
        { name: 'own_props' as const, label: 'Do you have your own props?' },
        { name: 'rentable_clothing' as const, label: 'Do you have clothing available to rent?' },
      ] as const).map(({ name, label }) => (
        <div key={name}>
          <label className="block text-sm font-medium mb-2">{label} <span className="text-red-500">*</span></label>
          <div className="flex gap-3">
            {(['true', 'false'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  value={v}
                  {...form.register(name, { setValueAs: (val) => val === 'true' })}
                  className="accent-zinc-900"
                />
                {v === 'true' ? 'Yes' : 'No'}
              </label>
            ))}
          </div>
        </div>
      ))}
      {rentable && (
        <div>
          <label className="block text-sm font-medium mb-1.5">What items / rental rate?</label>
          <textarea {...form.register('rental_notes')} rows={3} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" placeholder="Describe items and pricing..." />
        </div>
      )}
    </div>
  )
}
