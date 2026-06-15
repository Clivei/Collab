import { Camera, Palette, Sparkles, User } from 'lucide-react'
import type { Role } from '@/lib/types'

const roles: { value: Role; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'muse', label: 'Muse / Model', desc: 'Face of the campaign, fashion & lifestyle', icon: <User className="w-6 h-6" /> },
  { value: 'photographer', label: 'Photographer / Videographer', desc: 'Capture the moments behind the lens', icon: <Camera className="w-6 h-6" /> },
  { value: 'stylist', label: 'Stylist', desc: 'Wardrobe, props, and scene coordination', icon: <Sparkles className="w-6 h-6" /> },
  { value: 'mua', label: 'MUA', desc: 'Makeup & beauty artistry', icon: <Palette className="w-6 h-6" /> },
]

export function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-center">What best describes you?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roles.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onSelect(r.value)}
            className="flex items-start gap-4 bg-white border border-zinc-200 hover:border-amber-400 hover:shadow-sm rounded-2xl p-5 text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-amber-50 flex items-center justify-center text-zinc-600 group-hover:text-amber-600 transition-colors shrink-0">
              {r.icon}
            </div>
            <div>
              <div className="font-semibold text-sm">{r.label}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{r.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
