import { requireProfile } from "@/lib/auth";
import { BANK_OPTIONS } from "@/lib/types";
import PushManager from "@/components/PushManager";
import { saveBankAction, updatePhoneAction, togglePushMuteAction } from "./actions";

export default async function ProfilePage() {
  const { supabase, profile } = await requireProfile();
  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();
  const { data: dept } = profile.department_id
    ? await supabase.from("departments").select("name").eq("id", profile.department_id).single()
    : { data: null };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>

      <div className="card space-y-1 text-sm">
        <p className="text-lg font-semibold">
          {profile.full_name}{" "}
          {profile.badge && <span className="chip bg-neutral-100 text-neutral-600">{profile.badge}</span>}
        </p>
        <p className="text-neutral-500">{dept?.name ?? "—"} · {profile.work_type}</p>
        <p className="text-neutral-500">{profile.email}</p>
        {profile.intern_end && (
          <p className="text-amber-600">Periode magang: {profile.intern_start ?? "?"} → {profile.intern_end}</p>
        )}
      </div>

      <form action={updatePhoneAction} className="card space-y-3">
        <h2 className="font-semibold">Nomor WhatsApp</h2>
        <p className="text-xs text-neutral-400">
          Format internasional tanpa +, contoh 62812xxxxxxx (dipakai untuk rincian gaji via WA).
        </p>
        <input name="phone" className="input" defaultValue={profile.phone ?? ""} placeholder="62812…" />
        <button className="btn-secondary">Simpan</button>
      </form>

      <form action={saveBankAction} className="card space-y-3">
        <h2 className="font-semibold">🏦 Rekening bank {!bank && <span className="chip bg-red-100 text-red-700">wajib diisi</span>}</h2>
        {bank && (
          <p className="text-sm text-neutral-500">
            Aktif: {bank.bank_name} ·{" "}
            <span className="font-mono">{bank.account_number}</span> a.n. {bank.account_holder_name}{" "}
            {bank.verified_at ? (
              <span className="chip bg-emerald-100 text-emerald-700">✅ terverifikasi</span>
            ) : bank.confirmed_by_employee ? (
              <span className="chip bg-sky-100 text-sky-700">menunggu verifikasi</span>
            ) : (
              <span className="chip bg-amber-100 text-amber-700">🟡 belum dikonfirmasi</span>
            )}
          </p>
        )}
        <p className="text-xs text-neutral-400">
          Mengubah data membuat baris baru — riwayat lama tetap tersimpan (tidak pernah dihapus).
        </p>
        <div>
          <label className="label">Bank</label>
          <select name="bank_name" className="input" defaultValue={bank?.bank_name ?? "BCA"}>
            {BANK_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Nomor rekening</label>
          <input name="account_number" className="input" required inputMode="numeric" />
        </div>
        <div>
          <label className="label">Nama pemilik rekening</label>
          <input
            name="account_holder_name"
            className="input"
            required
            defaultValue={bank?.account_holder_name ?? profile.full_name}
          />
        </div>
        <button className="btn-primary">{bank ? "Perbarui rekening" : "Simpan rekening"}</button>
      </form>

      <div className="card space-y-3">
        <h2 className="font-semibold">🔔 Notifikasi</h2>
        <PushManager />
        <form action={togglePushMuteAction} className="flex items-center justify-between text-sm">
          <span>Reminder absen (09:00 / 17:00)</span>
          <button className="btn-secondary !px-3 !py-1 text-xs">
            {profile.push_muted ? "Aktifkan" : "Matikan"}
          </button>
        </form>
      </div>

      <form action="/auth/signout" method="post">
        <button className="btn-danger w-full">Keluar</button>
      </form>
    </div>
  );
}
