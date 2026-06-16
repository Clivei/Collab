import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signup')

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Collaborator'

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <div className="font-semibold text-sm">NoraPadel</div>
        <nav className="flex items-center gap-6 text-sm text-zinc-500">
          <a href="/portal" className="hover:text-zinc-900 transition-colors">My Projects</a>
          <a href="/portal/board" className="hover:text-zinc-900 transition-colors">Concept Board</a>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 hidden sm:block">{displayName}</span>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Sign out</button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
