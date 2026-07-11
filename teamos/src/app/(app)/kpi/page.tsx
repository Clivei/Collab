import { requireProfile } from "@/lib/auth";
import { dateLabelID } from "@/lib/tz";
import type { KpiAssignment, KpiEntry } from "@/lib/types";
import { weightedTotal } from "@/lib/report";

export default async function KpiPage() {
  const { supabase, profile } = await requireProfile();

  // RLS: employee sees only non-revoked assignments and shared entries.
  const { data: assignments } = await supabase
    .from("kpi_assignments")
    .select("*")
    .eq("profile_id", profile.id)
    .order("period_start", { ascending: false });

  const list = (assignments ?? []) as KpiAssignment[];
  const { data: entries } = list.length
    ? await supabase
        .from("kpi_entries")
        .select("*")
        .in("assignment_id", list.map((a) => a.id))
    : { data: [] as KpiEntry[] };

  const entriesByAssignment = new Map<string, KpiEntry[]>();
  for (const e of (entries ?? []) as KpiEntry[]) {
    const arr = entriesByAssignment.get(e.assignment_id) ?? [];
    arr.push(e);
    entriesByAssignment.set(e.assignment_id, arr);
  }

  if (!list.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">KPI</h1>
        <div className="card text-sm text-neutral-500">
          Belum ada KPI yang dikirim ke kamu. Kotak KPI akan muncul di sini saat owner/manager
          mengirimkannya.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">KPI</h1>
      {list.map((a) => {
        const shared = (entriesByAssignment.get(a.id) ?? []).find(
          (e) => e.status === "shared_with_employee"
        );
        const total = shared ? weightedTotal(a, shared) : null;
        return (
          <div key={a.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  🎯 {dateLabelID(a.period_start)} → {dateLabelID(a.period_end)}
                </h2>
                <p className="text-xs text-neutral-500">Ini target kamu untuk periode ini.</p>
              </div>
              {a.status === "completed" && (
                <span className="chip bg-neutral-100 text-neutral-600">selesai</span>
              )}
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>Metrik</th>
                  <th>Target</th>
                  <th>Bobot</th>
                  {shared && <th>Skor</th>}
                </tr>
              </thead>
              <tbody>
                {a.metrics.map((m) => {
                  const score = shared?.scores.find((s) => s.metric_key === m.metric_key);
                  return (
                    <tr key={m.metric_key}>
                      <td>
                        <p className="font-medium">{m.label}</p>
                        <p className="text-xs text-neutral-400">{m.description}</p>
                      </td>
                      <td>
                        {m.target} {m.unit}
                      </td>
                      <td>{m.weight}%</td>
                      {shared && (
                        <td>
                          <b>{score?.score_0_100 ?? "—"}</b>
                          {score?.note && <p className="text-xs text-neutral-400">{score.note}</p>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shared && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                Total tertimbang: <b>{total}</b> / 100
                {shared.overall_note && <p className="mt-1 text-xs">{shared.overall_note}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
