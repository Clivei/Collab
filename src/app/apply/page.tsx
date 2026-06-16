'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { museSchema, photographerSchema, stylistSchema, muaSchema, type MuseFormData, type PhotographerFormData, type StylistFormData, type MuaFormData } from '@/lib/validations'
import { computeAge } from '@/lib/utils'
import { RoleSelector } from '@/components/intake/RoleSelector'
import { MuseFields } from '@/components/intake/MuseFields'
import { PhotographerFields } from '@/components/intake/PhotographerFields'
import { StylistFields } from '@/components/intake/StylistFields'
import { MuaFields } from '@/components/intake/MuaFields'
import { Button } from '@/components/ui/button'
import type { Role } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

type FormData = MuseFormData | PhotographerFormData | StylistFormData | MuaFormData

const schemaMap = { muse: museSchema, photographer: photographerSchema, stylist: stylistSchema, mua: muaSchema }

export default function ApplyPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: role ? zodResolver(schemaMap[role]) : undefined,
    defaultValues: { interests: [], setups: [] } as Partial<FormData>,
  })

  const watchDob = (form.watch as (name: string) => unknown)('dob') as string | undefined
  const age = watchDob ? computeAge(watchDob) : null
  const isMinor = age !== null && age < 18

  async function onSubmit(data: FormData) {
    if (isMinor && !(data as MuseFormData).age_confirmed) {
      form.setError('age_confirmed' as never, { message: 'You must confirm you are 18 or older' })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const id = crypto.randomUUID()
      const { full_name, wa_number, notes, role: _role, ...rest } = data as Record<string, unknown>
      const details = rest
      const { error: dbError } = await supabase
        .from('submissions')
        .insert({ id, full_name, wa_number, notes, role, details })
      if (dbError) throw dbError
      setSubmissionId(id)
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">You&apos;re in!</h1>
          <p className="text-zinc-500 mb-4">
            Thanks for applying to collaborate with NoraPadel. We&apos;ll reach out via WhatsApp when there&apos;s a session that matches your profile.
          </p>
          {submissionId && (
            <p className="text-xs text-zinc-400 mb-6">Reference: {submissionId}</p>
          )}
          <button
            onClick={() => { setSubmitted(false); setRole(null); form.reset() }}
            className="text-sm text-amber-600 hover:underline"
          >
            Submit another application
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Join NoraPadel Collabs</h1>
          <p className="text-zinc-500">Tell us about yourself and we&apos;ll match you with content sessions in Surabaya.</p>
        </div>

        {!role ? (
          <RoleSelector onSelect={(r) => { setRole(r); form.setValue('role' as never, r as never) }} />
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setRole(null); form.reset() }}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <span className="text-sm font-medium text-zinc-400">Role:</span>
                <span className="text-sm font-semibold">{role === 'mua' ? 'MUA' : role === 'photographer' ? 'Photographer / Videographer' : role === 'muse' ? 'Muse / Model' : 'Stylist'}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Full Name <span className="text-red-500">*</span></label>
                  <input {...form.register('full_name')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Your full name" />
                  {form.formState.errors.full_name && <p className="text-xs text-red-500 mt-1">{(form.formState.errors.full_name as {message?: string})?.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">WhatsApp Number <span className="text-red-500">*</span></label>
                  <input {...form.register('wa_number')} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" placeholder="+62 812 3456 7890" />
                  {form.formState.errors.wa_number && <p className="text-xs text-red-500 mt-1">{(form.formState.errors.wa_number as {message?: string})?.message}</p>}
                </div>
              </div>

              {role === 'muse' && <MuseFields form={form as ReturnType<typeof useForm<MuseFormData>>} isMinor={isMinor} age={age} />}
              {role === 'photographer' && <PhotographerFields form={form as ReturnType<typeof useForm<PhotographerFormData>>} />}
              {role === 'stylist' && <StylistFields form={form as ReturnType<typeof useForm<StylistFormData>>} />}
              {role === 'mua' && <MuaFields form={form as ReturnType<typeof useForm<MuaFormData>>} />}

              <div>
                <label className="block text-sm font-medium mb-1.5">Additional Notes</label>
                <textarea {...form.register('notes')} rows={3} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none" placeholder="Anything else you'd like us to know?" />
              </div>
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-3 rounded-xl text-sm font-medium">
              {loading ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
