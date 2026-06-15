import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <div className="font-semibold text-sm">NoraPadel Admin</div>
        <nav className="flex items-center gap-6 text-sm text-zinc-500">
          <a href="/admin/dashboard" className="hover:text-zinc-900 transition-colors">Dashboard</a>
          <a href="/apply" className="hover:text-zinc-900 transition-colors" target="_blank">Public Form</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
