"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KpiMetricDef } from "@/lib/types";

interface EmployeeOpt {
  id: string;
  name: string;
  roleId: string | null;
}
interface RoleOpt {
  id: string;
  name: string;
  rubric: KpiMetricDef[];
}
interface MetricRow {
  metric_key: string;
  label: string;
  description: string;
  target: number;
  unit: string;
  weight: number;
}
interface Suggestion extends MetricRow {
  rationale: string;
}

export default function KpiAssignBuilder({
  employees,
  roles,
  preselect,
}: {
  employees: EmployeeOpt[];
  roles: RoleOpt[];
  preselect: string | null;
}) {
  const router = useRouter();
  const today = new Date();
  const ym = today.toISOString().slice(0, 7);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const [employeeId, setEmployeeId] = useState(preselect ?? "");
  const [periodStart, setPeriodStart] = useState(`${ym}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${ym}-${String(lastDay).padStart(2, "0")}`);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const employee = employees.find((e) => e.id === employeeId);
  const role = roles.find((r) => r.id === employee?.roleId) ?? null;
  const weightSum = useMemo(() => metrics.reduce((a, m) => a + (Number(m.weight) || 0), 0), [metrics]);

  function addMetric(m: Partial<MetricRow>) {
    setMetrics((prev) => [
      ...prev,
      {
        metric_key: m.metric_key ?? `custom_${prev.length + 1}`,
        label: m.label ?? "",
        description: m.description ?? "",
        target: m.target ?? 0,
        unit: m.unit ?? "",
        weight: m.weight ?? 0,
      },
    ]);
  }

  function updateMetric(i: number, patch: Partial<MetricRow>) {
    setMetrics((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function askAI() {
    if (!employeeId) return;
    setAiLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile_id: employeeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI error");
      setSuggestions(data.suggestions);
      setLogId(data.log_id);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setAiLoading(false);
    }
  }

  async function send() {
    if (!employeeId || !metrics.length) return;
    if (weightSum !== 100) {
      setMessage("Bobot harus berjumlah tepat 100 sebelum dikirim.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const accepted = suggestions?.filter((s) => metrics.some((m) => m.metric_key === s.metric_key));
      const res = await fetch("/api/kpi/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_id: employeeId,
          period_start: periodStart,
          period_end: periodEnd,
          metrics,
          log_id: logId,
          accepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "gagal mengirim");
      router.push("/admin/kpi");
      router.refresh();
    } catch (err) {
      setMessage(String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Kirim KPI Box</h1>

      <div className="card grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Karyawan</label>
          <select className="input" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setSuggestions(null); setLogId(null); }}>
            <option value="">— pilih —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Periode mulai</label>
          <input type="date" className="input" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div>
          <label className="label">Periode selesai</label>
          <input type="date" className="input" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>

      {/* Role library pick-list */}
      {role && (
        <div className="card">
          <h2 className="mb-2 font-semibold">
            Library role: {role.name} <span className="text-xs font-normal text-neutral-400">(tap untuk menambah)</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {role.rubric.map((m) => (
              <button
                key={m.metric_key}
                type="button"
                disabled={metrics.some((x) => x.metric_key === m.metric_key)}
                onClick={() => addMetric({ ...m, target: m.default_target, weight: 0 })}
                className="btn-secondary !py-1 text-xs disabled:opacity-30"
              >
                + {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saran AI */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">✨ Saran AI</h2>
          <button type="button" onClick={askAI} disabled={!employeeId || aiLoading} className="btn-secondary text-xs">
            {aiLoading ? "Meminta saran…" : "Minta saran AI"}
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          Saran adalah checkbox, bukan keputusan — tidak ada yang otomatis diterapkan. Panggilan &
          pilihanmu tercatat di audit log.
        </p>
        {suggestions && (
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const added = metrics.some((m) => m.metric_key === s.metric_key);
              return (
                <li key={s.metric_key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={added}
                    onChange={(e) =>
                      e.target.checked
                        ? addMetric(s)
                        : setMetrics((prev) => prev.filter((m) => m.metric_key !== s.metric_key))
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">
                      {s.label} — target {s.target} {s.unit}, bobot {s.weight}%
                    </p>
                    <p className="text-xs text-neutral-400">{s.rationale}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Selected metrics editor */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Metrik terpilih</h2>
          <button type="button" onClick={() => addMetric({})} className="btn-secondary text-xs">
            + metrik custom
          </button>
        </div>
        {metrics.map((m, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2 text-sm">
            <input
              className="input col-span-4 !py-1"
              value={m.label}
              placeholder="Label"
              onChange={(e) => updateMetric(i, { label: e.target.value })}
            />
            <input
              className="input col-span-3 !py-1"
              value={m.description}
              placeholder="Deskripsi"
              onChange={(e) => updateMetric(i, { description: e.target.value })}
            />
            <input
              className="input col-span-1 !py-1"
              type="number"
              value={m.target}
              onChange={(e) => updateMetric(i, { target: Number(e.target.value) })}
            />
            <input
              className="input col-span-1 !py-1"
              value={m.unit}
              placeholder="unit"
              onChange={(e) => updateMetric(i, { unit: e.target.value })}
            />
            <div className="col-span-2 flex items-center gap-1">
              <input
                className="input !py-1"
                type="number"
                value={m.weight}
                onChange={(e) => updateMetric(i, { weight: Number(e.target.value) })}
              />
              <span className="text-xs text-neutral-400">%</span>
            </div>
            <button
              type="button"
              className="col-span-1 text-red-500"
              onClick={() => setMetrics((prev) => prev.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        {!metrics.length && <p className="text-sm text-neutral-400">Belum ada metrik — ambil dari library, saran AI, atau tulis sendiri.</p>}
        <p className={`text-sm font-medium ${weightSum === 100 ? "text-emerald-600" : "text-red-500"}`}>
          Total bobot: {weightSum}% {weightSum !== 100 && "(harus 100 untuk mengirim)"}
        </p>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      <button onClick={send} disabled={submitting || !employeeId || weightSum !== 100} className="btn-primary w-full">
        {submitting ? "Mengirim…" : `📬 Kirim ke ${employee?.name ?? "…"}`}
      </button>
    </div>
  );
}
