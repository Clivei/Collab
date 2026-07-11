import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthLabelID, wibDateStr } from "@/lib/tz";
import { generateReportAction } from "./actions";

export default async function ReportsPage() {
  await requireManager();
  const admin = createAdminClient();
  const [{ data: reports }, { data: entities }] = await Promise.all([
    admin
      .from("monthly_reports")
      .select("id, entity_id, period_month, version, model, generated_at, entities(name)")
      .order("generated_at", { ascending: false }),
    admin.from("entities").select("id, name"),
  ]);

  // previous month default
  const now = wibDateStr();
  const [y, m] = now.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Laporan Bulanan (AI)</h1>
      <p className="-mt-3 text-xs text-neutral-500">
        Analisis otomatis — verifikasi sebelum mengambil tindakan. Hanya owner/manager; tidak pernah
        ditampilkan ke karyawan.
      </p>

      <form action={generateReportAction} className="card flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Periode</label>
          <input type="month" name="month" defaultValue={prev} className="input !w-auto" required />
        </div>
        <div>
          <label className="label">Entity</label>
          <select name="entity_id" className="input !w-auto">
            <option value="">Gabungan (Nora + Gridline)</option>
            {(entities ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Generate / Regenerate</button>
        <p className="w-full text-xs text-neutral-400">
          Regenerate membuat versi baru — versi lama tetap tersimpan (immutable).
        </p>
      </form>

      <div className="card">
        <ul className="space-y-2 text-sm">
          {(reports ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <Link href={`/admin/reports/${r.id}`} className="font-medium hover:text-emerald-600">
                {monthLabelID(r.period_month.slice(0, 7))} —{" "}
                {(r.entities as unknown as { name: string } | null)?.name ?? "Gabungan"}
              </Link>
              <span className="text-xs text-neutral-400">
                v{r.version} · {r.model} · {r.generated_at.slice(0, 10)}
              </span>
            </li>
          ))}
          {!reports?.length && <li className="text-neutral-400">Belum ada laporan. Generate di atas, atau tunggu cron tanggal 1.</li>}
        </ul>
      </div>
    </div>
  );
}
