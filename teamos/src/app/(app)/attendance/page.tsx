import { requireProfile } from "@/lib/auth";
import { wibDateStr, dateLabelID, timeLabelWIB } from "@/lib/tz";
import AttendanceCapture from "@/components/AttendanceCapture";

export default async function AttendancePage() {
  const { supabase, profile } = await requireProfile();
  const today = wibDateStr();

  const [{ data: todayRec }, { data: history }, { data: entity }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("work_date", today)
      .maybeSingle(),
    supabase
      .from("attendance_records")
      .select("*")
      .eq("profile_id", profile.id)
      .order("work_date", { ascending: false })
      .limit(14),
    profile.entity_id
      ? supabase.from("entities").select("*").eq("id", profile.entity_id).single()
      : supabase.from("entities").select("*").eq("name", "NoraPadel").single(),
  ]);

  const kind: "in" | "out" | null = !todayRec?.clock_in_at
    ? "in"
    : !todayRec?.clock_out_at
      ? "out"
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Absensi</h1>

      {profile.employment_status !== "active" ? (
        <div className="card text-sm text-neutral-500">
          Status kamu masih <b>{profile.employment_status}</b> — absensi belum diaktifkan.
        </div>
      ) : kind ? (
        <AttendanceCapture
          kind={kind}
          radius={entity?.geofence_radius_m ?? 200}
        />
      ) : (
        <div className="card border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          ✅ Absensi hari ini lengkap — masuk {timeLabelWIB(todayRec!.clock_in_at!)}, pulang{" "}
          {timeLabelWIB(todayRec!.clock_out_at!)}.
        </div>
      )}

      <p className="text-xs text-neutral-400">
        Lokasi & selfie diperlukan untuk verifikasi kehadiran (radius {entity?.geofence_radius_m ?? 200} m dari
        kantor). Selfie disimpan privat dan dihapus otomatis setelah 90 hari.
      </p>

      <div className="card">
        <h2 className="mb-2 font-semibold">Riwayat 14 hari</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Masuk</th>
              <th>Pulang</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(history ?? []).map((r) => (
              <tr key={r.id}>
                <td>{dateLabelID(r.work_date)}</td>
                <td>{r.clock_in_at ? timeLabelWIB(r.clock_in_at) : "—"}</td>
                <td>{r.clock_out_at ? timeLabelWIB(r.clock_out_at) : "—"}</td>
                <td>
                  {r.late && <span className="chip bg-amber-100 text-amber-700">telat</span>}{" "}
                  {r.missing_clock_out && (
                    <span className="chip bg-red-100 text-red-700">no clock-out</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
