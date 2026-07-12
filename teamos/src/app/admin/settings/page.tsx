import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveEntityAction } from "./actions";

export default async function SettingsPage() {
  await requireOwner();
  const admin = createAdminClient();
  const { data: entities } = await admin.from("entities").select("*").order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings (owner)</h1>
      {(entities ?? []).map((e) => (
        <form key={e.id} action={saveEntityAction} className="card grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="entity_id" value={e.id} />
          <h2 className="font-semibold sm:col-span-3">{e.name}</h2>
          <div>
            <label className="label">Office latitude (pin NORA P dari Google Maps)</label>
            <input name="office_lat" className="input" defaultValue={e.office_lat} />
          </div>
          <div>
            <label className="label">Office longitude</label>
            <input name="office_lng" className="input" defaultValue={e.office_lng} />
          </div>
          <div>
            <label className="label">Radius geofence (m)</label>
            <input name="geofence_radius_m" type="number" className="input" defaultValue={e.geofence_radius_m} />
          </div>
          <div>
            <label className="label">Jam masuk</label>
            <input name="work_start_time" type="time" className="input" defaultValue={String(e.work_start_time).slice(0, 5)} />
          </div>
          <div>
            <label className="label">Jam pulang</label>
            <input name="work_end_time" type="time" className="input" defaultValue={String(e.work_end_time).slice(0, 5)} />
          </div>
          <div>
            <label className="label">Toleransi telat (menit)</label>
            <input name="late_grace_min" type="number" className="input" defaultValue={e.late_grace_min} />
          </div>
          <div>
            <label className="label">Hari kerja / bulan (pembagi rate harian)</label>
            <input name="working_days_per_month" type="number" className="input" defaultValue={e.working_days_per_month} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="manager_recap_enabled" defaultChecked={e.manager_recap_enabled} />
            Kirim rekap harian WA juga ke manajer entity ini
          </label>
          <button className="btn-primary sm:col-span-3">Simpan {e.name}</button>
        </form>
      ))}
      <p className="text-xs text-neutral-400">
        Koordinat default = pin NORA P (-7.278475, 112.632539). Kalau kantor pindah, tempel pin baru
        dari Google Maps (klik kanan → salin koordinat).
      </p>
    </div>
  );
}
