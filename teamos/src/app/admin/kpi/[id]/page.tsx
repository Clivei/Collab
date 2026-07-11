import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { weightedTotal } from "@/lib/report";
import { dateLabelID } from "@/lib/tz";
import type { KpiAssignment, KpiEntry } from "@/lib/types";
import { saveScoresAction, shareEntryAction, revokeAssignmentAction } from "./actions";

export default async function KpiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManager();
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("kpi_assignments")
    .select("*, profiles!kpi_assignments_profile_id_fkey(full_name)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const a = data as KpiAssignment & { profiles: { full_name: string } };

  const { data: entries } = await admin
    .from("kpi_entries")
    .select("*")
    .eq("assignment_id", id)
    .order("created_at", { ascending: false });
  const latest = ((entries ?? []) as KpiEntry[])[0] ?? null;
  const scoreOf = (key: string) => latest?.scores.find((s) => s.metric_key === key);

  return (
    <div className="space-y-4">
      <Link href="/admin/kpi" className="text-sm text-neutral-400 hover:text-emerald-600">
        ← KPI
      </Link>
      <h1 className="text-xl font-bold">
        {a.profiles.full_name}{" "}
        {a.status === "revoked" && <span className="chip bg-red-100 text-red-700">revoked</span>}
        {a.status === "completed" && <span className="chip bg-neutral-100 text-neutral-600">completed</span>}
      </h1>
      <p className="-mt-3 text-sm text-neutral-500">
        {dateLabelID(a.period_start)} → {dateLabelID(a.period_end)}
        {a.revoke_reason && ` · dicabut: ${a.revoke_reason}`}
      </p>

      {/* Scoring (0–100 per metric, weighted total auto-computed) */}
      <form action={saveScoresAction} className="card space-y-3">
        <input type="hidden" name="assignment_id" value={a.id} />
        <h2 className="font-semibold">Skor</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Metrik</th>
              <th>Target</th>
              <th>Bobot</th>
              <th>Skor 0–100</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {a.metrics.map((m) => (
              <tr key={m.metric_key}>
                <td>
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs text-neutral-400">{m.description}</p>
                </td>
                <td>
                  {m.target} {m.unit}
                </td>
                <td>{m.weight}%</td>
                <td>
                  <input
                    name={`score_${m.metric_key}`}
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={scoreOf(m.metric_key)?.score_0_100 ?? ""}
                    className="input !w-20 !py-1"
                    disabled={a.status === "revoked"}
                  />
                </td>
                <td>
                  <input
                    name={`note_${m.metric_key}`}
                    defaultValue={scoreOf(m.metric_key)?.note ?? ""}
                    className="input !py-1"
                    disabled={a.status === "revoked"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <label className="label">Catatan keseluruhan</label>
          <textarea
            name="overall_note"
            className="input"
            rows={2}
            defaultValue={latest?.overall_note ?? ""}
            disabled={a.status === "revoked"}
          />
        </div>
        {latest && (
          <p className="text-sm">
            Total tertimbang: <b>{weightedTotal(a, latest) ?? "—"}</b> / 100 ·{" "}
            {latest.status === "shared_with_employee" ? (
              <span className="text-emerald-600">sudah dishare ke karyawan</span>
            ) : (
              <span className="text-amber-600">draft — belum dishare</span>
            )}
          </p>
        )}
        {a.status !== "revoked" && <button className="btn-secondary">💾 Simpan draft</button>}
      </form>

      {latest && latest.status === "draft" && a.status !== "revoked" && (
        <form action={shareEntryAction}>
          <input type="hidden" name="entry_id" value={latest.id} />
          <input type="hidden" name="assignment_id" value={a.id} />
          <button className="btn-primary w-full">📤 Share dengan karyawan</button>
        </form>
      )}

      {/* Revoke — reason required; assignment + entries remain in history forever */}
      {a.status === "active" && (
        <form action={revokeAssignmentAction} className="card space-y-2 border-red-200">
          <input type="hidden" name="assignment_id" value={a.id} />
          <h2 className="font-semibold text-red-700">Cabut (revoke) assignment</h2>
          <p className="text-xs text-neutral-400">
            Box hilang dari tampilan aktif karyawan seketika, tapi assignment + skor tetap permanen di
            riwayat & laporan (badge "revoked"). Edit metrik = revoke + kirim baru.
          </p>
          <input name="reason" placeholder="Alasan (wajib)" className="input" required />
          <button className="btn-danger">Cabut assignment</button>
        </form>
      )}
    </div>
  );
}
