import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateLabelID } from "@/lib/tz";
import { createCycleAction } from "./actions";

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-500",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-amber-100 text-amber-700",
  published: "bg-sky-100 text-sky-700",
};

export default async function PeerAdminPage() {
  await requireManager();
  const admin = createAdminClient();
  const { data: cycles } = await admin
    .from("peer_review_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  // quarterly cadence suggestion
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const suggestedName = `Q${q} ${now.getFullYear()}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Peer Assessment — siklus</h1>

      <form action={createCycleAction} className="card space-y-3">
        <h2 className="font-semibold">Buka siklus baru (disarankan per kuartal)</h2>
        <p className="text-xs text-neutral-400">
          Sistem otomatis menugaskan 3–5 penilai per orang dari rekan satu departemen (lintas entity
          diperbolehkan, tanpa self-review) — bisa kamu ubah di detail siklus sebelum dibuka. Skor peer
          adalah sinyal pengembangan — tidak pernah masuk rumus gaji/KPI.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Nama</label>
            <input name="name" className="input" defaultValue={suggestedName} required />
          </div>
          <div>
            <label className="label">Dibuka</label>
            <input name="opens_at" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Ditutup (default 2 minggu)</label>
            <input name="closes_at" type="date" className="input" required />
          </div>
        </div>
        <button className="btn-primary">Buat siklus (draft)</button>
      </form>

      <div className="card">
        <h2 className="mb-2 font-semibold">Semua siklus</h2>
        <ul className="space-y-2">
          {(cycles ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <Link href={`/admin/peer/${c.id}`} className="font-medium hover:text-emerald-600">
                {c.name}
              </Link>
              <span>
                {dateLabelID(c.opens_at.slice(0, 10))} → {dateLabelID(c.closes_at.slice(0, 10))}{" "}
                <span className={`chip ${STATUS_CHIP[c.status]}`}>{c.status}</span>
              </span>
            </li>
          ))}
          {!cycles?.length && <li className="text-neutral-400">Belum ada siklus.</li>}
        </ul>
      </div>
    </div>
  );
}
