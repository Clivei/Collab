import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { wibDateStr, dateLabelID, timeLabelWIB } from "@/lib/tz";
import { maskAccount } from "@/lib/types";
import { confirmBankAction, completeOnboardingTaskAction } from "./actions";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const today = wibDateStr();

  const [{ data: attendance }, { data: bank }, { data: kpiBoxes }, { data: tasks }, { data: peerPending }] =
    await Promise.all([
      supabase
        .from("attendance_records")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("work_date", today)
        .maybeSingle(),
      supabase
        .from("bank_accounts")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("kpi_assignments")
        .select("id, period_start, period_end, status")
        .eq("profile_id", profile.id)
        .eq("status", "active"),
      supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("status", "pending"),
      supabase
        .from("peer_review_requests")
        .select("id")
        .eq("rater_id", profile.id)
        .eq("status", "pending"),
    ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Halo, {profile.full_name.split(" ")[0]} 👋</h1>
      <p className="-mt-3 text-sm text-neutral-500">{dateLabelID(today)}</p>

      {/* Bank nag banner (§3.3 onboarding gate) */}
      {!bank && (
        <Link href="/profile" className="card block border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">
            🏦 Data rekening bank kamu belum diisi — lengkapi sekarang di Profil.
          </p>
        </Link>
      )}
      {bank && !bank.confirmed_by_employee && bank.entered_by && (
        <div className="card border-amber-300 bg-amber-50">
          <p className="mb-2 text-sm font-medium text-amber-800">
            Konfirmasi rekening kamu: {bank.bank_name} {maskAccount(bank.account_number)} a.n.{" "}
            {bank.account_holder_name}
          </p>
          <form action={confirmBankAction}>
            <input type="hidden" name="bank_id" value={bank.id} />
            <button className="btn-primary !py-1.5 text-xs">✓ Benar, konfirmasi</button>
          </form>
        </div>
      )}

      {/* Attendance today */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Absensi hari ini</h2>
            <p className="text-sm text-neutral-500">
              {attendance?.clock_in_at
                ? `Masuk ${timeLabelWIB(attendance.clock_in_at)}${attendance.late ? " (telat)" : ""}${
                    attendance.clock_out_at ? ` · Pulang ${timeLabelWIB(attendance.clock_out_at)}` : ""
                  }`
                : "Belum absen masuk"}
            </p>
          </div>
          <Link href="/attendance" className="btn-primary">
            {attendance?.clock_in_at ? (attendance.clock_out_at ? "Lihat" : "Absen pulang") : "Absen masuk"}
          </Link>
        </div>
      </div>

      {/* KPI box — only exists while an active assignment exists */}
      {(kpiBoxes?.length ?? 0) > 0 && (
        <Link href="/kpi" className="card block">
          <h2 className="font-semibold">🎯 Ini target kamu bulan ini</h2>
          <p className="text-sm text-neutral-500">
            {kpiBoxes!.length} KPI aktif — tap untuk lihat metrik & target.
          </p>
        </Link>
      )}

      {/* Peer review pending */}
      {(peerPending?.length ?? 0) > 0 && (
        <Link href="/peer" className="card block border-sky-200 bg-sky-50">
          <p className="text-sm font-medium text-sky-800">
            🤝 {peerPending!.length} penilaian rekan menunggu kamu (≤ 3 menit per orang).
          </p>
        </Link>
      )}

      {/* Onboarding tasks */}
      {(tasks?.length ?? 0) > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Checklist onboarding</h2>
          <ul className="space-y-2">
            {tasks!.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span>
                <form action={completeOnboardingTaskAction}>
                  <input type="hidden" name="task_id" value={t.id} />
                  <button className="btn-secondary !px-2 !py-1 text-xs">Selesai</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold">Sisa cuti tahunan</h2>
        <p className="text-2xl font-bold text-emerald-600">
          {Number(profile.leave_balance_annual) + Number(profile.leave_balance_carryover)} hari
        </p>
      </div>
    </div>
  );
}
