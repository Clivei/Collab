import { requireProfile } from "@/lib/auth";
import { dateLabelID } from "@/lib/tz";
import { submitLeaveAction, cancelLeaveAction } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  annual: "Cuti tahunan",
  sick: "Sakit",
  unpaid: "Cuti tidak dibayar",
  special: "Cuti khusus",
  izin_late: "Izin datang telat",
  izin_early: "Izin pulang awal",
  half_day: "Half-day",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-500",
};

export default async function LeavePage() {
  const { supabase, profile } = await requireProfile();
  const { data: requests } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Cuti & Izin</h1>
      <p className="-mt-3 text-sm text-neutral-500">
        Sisa cuti tahunan:{" "}
        <b>{Number(profile.leave_balance_annual) + Number(profile.leave_balance_carryover)} hari</b>
        {" · "}Izin (telat/pulang awal) tidak memotong cuti; half-day memotong 0,5 hari.
      </p>

      <form action={submitLeaveAction} className="card space-y-3">
        <h2 className="font-semibold">Ajukan</h2>
        <div>
          <label className="label">Jenis</label>
          <select name="type" className="input" required>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dari tanggal</label>
            <input name="start_date" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Sampai tanggal</label>
            <input name="end_date" type="date" className="input" />
          </div>
        </div>
        <div>
          <label className="label">
            Jam (untuk izin telat/pulang awal — perkiraan datang/pulang)
          </label>
          <input name="izin_time" type="time" className="input" />
        </div>
        <div>
          <label className="label">Alasan</label>
          <textarea name="reason" className="input" rows={2} />
        </div>
        <button className="btn-primary w-full">Kirim pengajuan</button>
      </form>

      <div className="card">
        <h2 className="mb-2 font-semibold">Riwayat</h2>
        <ul className="space-y-2">
          {(requests ?? []).map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">
                  {TYPE_LABEL[r.type] ?? r.type}{" "}
                  <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
                </p>
                <p className="text-neutral-500">
                  {dateLabelID(r.start_date)}
                  {r.end_date !== r.start_date && ` → ${dateLabelID(r.end_date)}`}
                  {r.izin_time && ` · ${String(r.izin_time).slice(0, 5)}`}
                  {r.reason && ` · ${r.reason}`}
                </p>
                {r.review_note && <p className="text-xs text-neutral-400">Note: {r.review_note}</p>}
              </div>
              {r.status === "pending" && (
                <form action={cancelLeaveAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn-secondary !px-2 !py-1 text-xs">Batalkan</button>
                </form>
              )}
            </li>
          ))}
          {!requests?.length && <li className="text-sm text-neutral-400">Belum ada pengajuan.</li>}
        </ul>
      </div>
    </div>
  );
}
