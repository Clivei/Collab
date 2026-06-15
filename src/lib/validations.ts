import { z } from 'zod'

const mediaValueSchema = z.object({
  type: z.enum(['upload', 'gdrive']),
  url: z.string().min(1, 'Required'),
})

const commonSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  wa_number: z.string().min(8, 'WhatsApp number is required'),
  notes: z.string().optional(),
})

export const museSchema = commonSchema.extend({
  role: z.literal('muse'),
  height: z.coerce.number().min(50).max(250),
  weight: z.coerce.number().min(20).max(200),
  dob: z.string().min(1, 'Date of birth is required'),
  age_confirmed: z.boolean().optional(),
  ig: z.string().optional(),
  tiktok: z.string().optional(),
  threads: z.string().optional(),
  face_media: mediaValueSchema,
  body_media: mediaValueSchema,
  interests: z.array(z.string()).default([]),
  interest_other: z.string().optional(),
})

export const photographerSchema = commonSchema.extend({
  role: z.literal('photographer'),
  camera_model: z.string().min(1, 'Camera model is required'),
  lens: z.string().optional(),
  setups: z.array(z.string()).default([]),
  portfolio_media: mediaValueSchema,
})

export const stylistSchema = commonSchema.extend({
  role: z.literal('stylist'),
  can_coordinate: z.boolean(),
  own_props: z.boolean(),
  rentable_clothing: z.boolean(),
  rental_notes: z.string().optional(),
})

export const muaSchema = commonSchema.extend({
  role: z.literal('mua'),
  specialty: z.string().optional(),
  portfolio_media: mediaValueSchema.optional(),
})

export type MuseFormData = z.infer<typeof museSchema>
export type PhotographerFormData = z.infer<typeof photographerSchema>
export type StylistFormData = z.infer<typeof stylistSchema>
export type MuaFormData = z.infer<typeof muaSchema>
