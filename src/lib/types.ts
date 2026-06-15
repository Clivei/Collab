export type Role = 'muse' | 'photographer' | 'stylist' | 'mua'

export type SubmissionStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'archived'

export interface MediaValue {
  type: 'upload' | 'gdrive'
  url: string
}

export interface MuseDetails {
  height: number
  weight: number
  dob: string
  ig?: string
  tiktok?: string
  threads?: string
  face_media: MediaValue
  body_media: MediaValue
  interests: string[]
  interest_other?: string
}

export interface PhotographerDetails {
  camera_model: string
  lens?: string
  setups: string[]
  portfolio_media: MediaValue
}

export interface StylistDetails {
  can_coordinate: boolean
  own_props: boolean
  rentable_clothing: boolean
  rental_notes?: string
}

export interface MuaDetails {
  specialty?: string
  portfolio_media?: MediaValue
}

export interface Submission {
  id: string
  full_name: string
  role: Role
  wa_number: string
  notes?: string
  status: SubmissionStatus
  details: MuseDetails | PhotographerDetails | StylistDetails | MuaDetails
  edit_token?: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  title: string
  date?: string
  location?: string
  status: 'idea' | 'team_forming' | 'team_set' | 'scheduled' | 'shoot_day' | 'completed'
  notes?: string
  mood_board_url?: string
  created_at: string
}
