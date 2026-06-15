import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWALink(wa: string) {
  const digits = wa.replace(/\D/g, '')
  const normalized = digits.startsWith('0') ? '62' + digits.slice(1) : digits
  return `https://wa.me/${normalized}`
}

export function computeAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function isGDriveUrl(url: string): boolean {
  return /^https:\/\/(drive|docs)\.google\.com\//.test(url)
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    muse: 'Muse / Model',
    photographer: 'Photographer / Videographer',
    stylist: 'Stylist',
    mua: 'MUA',
  }
  return map[role] ?? role
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    approved: 'Approved',
    rejected: 'Rejected',
    archived: 'Archived',
  }
  return map[status] ?? status
}
