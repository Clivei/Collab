import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateLabelID } from "@/lib/tz";
import { reviewLeaveAction } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  annual: "Cuti tahunan",
  sick: "Sakit",
  unpaid: "Unpaid",
  special: "Khusus",
  izin_late: "Izin telat",
  izin_early: "Izin pulang awal",
  half_day: "Half-day",
};

export default async function AdminLeavePage() {
  await requireManager();
  const admin = createAdminClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    admin
      .from("leave_requests")
      .select("*, profiles!leave_requests_profile_id_fkey(full_name, leave_balance_annual, leave_balance_carryover)")
      .eq("status", "pending")
      .order("created_at"),
    admin
      .from("leave_requests")
      .select("*, profiles!leave_requests_profile_id_fkey(full_name)")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Persetujuan Cuti & Izin</h1>

      {(pending ?? []).map((r) => {
        const p = r.profiles as unknown as {
          full_name: string;
          leave_balance_annual: number;
          leave_balance_carryover: number;
        };
        return (
          <div key={r.id} className="card space-y-2">
            <p className="font-medium">
              {p.full_name} — {TYPE_LABEL[r.type] ?? r.type}{" "}
              <span className="text-sm text-neutral-400">
                ({dateLabelID(r.start_date)}
                {r.end_date !== r.start_date && ` → ${dateLabelID(r.end_date)}`}
                {r.izin_time && ` · ${String(r.izin_time).slice(0, 5)}`} · {r.days} hari)
              </span>
            </p>
            {r.reason && <p className="text-sm text-neutral-500">“{r.reason}”</p>}
            {r.type === "annual" && (
              <p className="text-xs text-neutral-400">
                Sisa cuti: {Number(p.leave_balance_annual) + Number(p.leave_balance_carryover)} hari
              </p>
            )}
            {(r.type === "izin_late" || r.type === "izin_early") && (
              <p className="text-xs text-sky-600">
                Izin disetujui akan menghapus flag {r.type === "izin_late" ? "telat" : "no clock-out"} di
                hari tsb.
              </p>
            )}
            <div className="flex gap-2">
              <form action={reviewLeaveAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="decision" value="approve" />
                <button className="btn-primary !py-1.5 text-xs">✓ Setujui</button>
              </form>
              <form action={reviewLeaveAction} className="flex gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="decision" value="reject" />
                <input name="note" placeholder="alasan (opsional)" className="input !w-48 !py-1 text-xs" />
                <button className="btn-danger !py-1.5 text-xs">✗ Tolak</button>
              </form>
            </div>
          </div>
        );
      })}
      {!pending?.length && <div className="card text-sm text-neutral-400">Tidak ada pengajuan pending.</div>}

      <div className="card">
        <h2 className="mb-2 font-semibold">Terbaru diproses</h2>
        <ul className="space-y-1 text-sm">
          {(recent ?? []).map((r) => (
            <li key={r.id}>
              {(r.profiles as unknown as { full_name: string }).full_name} · {TYPE_LABEL[r.type] ?? r.type} ·{" "}
              {dateLabelID(r.start_date)} ·{" "}
              <span className={r.status === "approved" ? "text-emerald-600" : "text-red-500"}>{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
