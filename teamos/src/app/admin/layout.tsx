import Link from "next/link";
import { requireManager } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireManager();
  const isOwner = profile.permission === "owner";

  const nav = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/attendance", label: "Absensi" },
    { href: "/admin/leave", label: "Cuti/Izin" },
    { href: "/admin/kpi", label: "KPI" },
    { href: "/admin/peer", label: "Peer" },
    { href: "/admin/reports", label: "Laporan" },
    ...(isOwner
      ? [
          { href: "/admin/wages", label: "Gaji" },
          { href: "/admin/settings", label: "Settings" },
        ]
      : []),
  ];

  return (
    <div className="mx-auto min-h-screen max-w-6xl">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-lg font-bold">
            Team<span className="text-emerald-600">OS</span>{" "}
            <span className="text-sm font-normal text-neutral-400">admin</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-emerald-600">
            ← App
          </Link>
        </div>
        <nav className="mt-2 flex gap-1 overflow-x-auto text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-neutral-600 hover:bg-neutral-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
