import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDaySummary, getMonthAttendance } from "@/lib/attendance-summary";
import { wibDateStr, wibMonthBounds, dateLabelID } from "@/lib/tz";
import { convertAbsenceToUnpaidAction } from "./actions";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireManager();
  const admin = createAdminClient();
  const { month } = await searchParams;
  const ym = month ?? wibDateStr().slice(0, 7);
  const { start, end } = wibMonthBounds(ym);
  const today = wibDateStr();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, employment_status")
    .eq("employment_status", "active")
    .neq("permission", "owner")
    .order("full_name");

  const rows = await Promise.all(
    (profiles ?? []).map(async (p) => ({
      profile: p,
      att: await getMonthAttendance(admin, p.id, start, end),
    }))
  );

  const day = await getDaySummary(admin, today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Absensi — grid manajer</h1>
        <form method="get">
          <input type="month" name="month" defaultValue={ym} className="input !w-auto" />
        </form>
      </div>

      {/* Today */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Hari ini · {dateLabelID(today)}</h2>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p>✅ Hadir: {day.present.length}</p>
          <p>
            ⏰ Telat: {day.late.length}{" "}
            <span className="text-neutral-400">{day.late.map((l) => `${l.name} ${l.time}`).join(", ")}</span>
          </p>
          <p>
            📝 Izin: {day.izin.length}{" "}
            <span className="text-neutral-400">{day.izin.map((i) => `${i.name} (${i.type})`).join(", ")}</span>
          </p>
          <p>
            🌴 Cuti: {day.cuti.length}{" "}
            <span className="text-neutral-400">{day.cuti.map((c) => c.name).join(", ")}</span>
          </p>
          <p>
            ❌ Tanpa ket.: {day.absent.length}{" "}
            <span className="text-neutral-400">{day.absent.join(", ")}</span>
          </p>
          <p>
            🚫 Ditolak geofence: {day.rejected.length}{" "}
            <span className="text-neutral-400">
              {day.rejected.map((r) => `${r.name} (${r.distance ?? "?"} m, ${r.time})`).join("; ")}
            </span>
          </p>
          <p>⚠️ Spoof flag: {day.spoofFlagged.length} {day.spoofFlagged.join(", ")}</p>
          <p>🕔 Belum clock-out: {day.notClockedOut.length} {day.notClockedOut.join(", ")}</p>
        </div>
      </div>

      {/* Month grid */}
      <div className="card overflow-x-auto !p-0">
        <table className="data min-w-[760px]">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Hadir</th>
              <th>Telat</th>
              <th>Izin</th>
              <th>Cuti</th>
              <th>Sakit</th>
              <th>Unpaid</th>
              <th>No clock-out</th>
              <th>Ditolak</th>
              <th>Spoof</th>
              <th>Avg masuk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ profile: p, att }) => (
              <tr key={p.id}>
                <td className="font-medium">{p.full_name}</td>
                <td>{att.present}</td>
                <td className={att.late > 2 ? "font-bold text-amber-600" : ""}>{att.late}</td>
                <td className={att.izin > 3 ? "font-bold text-sky-600" : ""}>{att.izin}</td>
                <td>{att.annual}</td>
                <td>{att.sick}</td>
                <td>{att.unpaid}</td>
                <td>{att.missingClockOut}</td>
                <td className={att.rejectedAttempts > 0 ? "font-bold text-red-600" : ""}>
                  {att.rejectedAttempts}
                </td>
                <td className={att.spoofFlags > 0 ? "font-bold text-red-600" : ""}>{att.spoofFlags}</td>
                <td>{att.avgClockIn ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Convert unexplained absence → unpaid leave (only this deducts wages) */}
      <form action={convertAbsenceToUnpaidAction} className="card space-y-2">
        <h2 className="font-semibold">Konversi absen tanpa keterangan → cuti tidak dibayar</h2>
        <p className="text-xs text-neutral-400">
          Absen tanpa keterangan tidak memotong estimasi gaji sampai dikonversi di sini (approved
          unpaid leave adalah satu-satunya pemotong).
        </p>
        <div className="flex flex-wrap gap-2">
          <select name="profile_id" className="input !w-auto" required>
            <option value="">— pilih karyawan —</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <input type="date" name="start_date" className="input !w-auto" required />
          <input type="date" name="end_date" className="input !w-auto" />
          <button className="btn-secondary">Konversi</button>
        </div>
      </form>
    </div>
  );
}
