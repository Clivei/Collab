import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  CalendarCheck,
  Home,
  Palmtree,
  Target,
  Users,
  UserCircle,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const isManager = profile.permission !== "employee";

  const nav = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/attendance", label: "Absen", icon: CalendarCheck },
    { href: "/leave", label: "Cuti", icon: Palmtree },
    { href: "/kpi", label: "KPI", icon: Target },
    { href: "/peer", label: "Peer", icon: HeartHandshake },
    { href: "/directory", label: "Tim", icon: Users },
    { href: "/profile", label: "Profil", icon: UserCircle },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold">
          Team<span className="text-emerald-600">OS</span>
        </Link>
        <div className="flex items-center gap-3">
          {isManager && (
            <Link href="/admin" className="btn-secondary !px-3 !py-1.5 text-xs">
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
          <span className="text-sm text-neutral-500">{profile.full_name.split(" ")[0]}</span>
        </div>
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl justify-around">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] text-neutral-500 hover:text-emerald-600"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
