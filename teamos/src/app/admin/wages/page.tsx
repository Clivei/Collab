import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWageRows, buildReceiptText } from "@/lib/wages";
import { formatRupiah } from "@/lib/utils";
import { wibDateStr } from "@/lib/tz";
import ReceiptShare from "@/components/ReceiptShare";

export default async function WagesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; filter?: string }>;
}) {
  await requireOwner();
  const { month, filter } = await searchParams;
  const ym = month ?? wibDateStr().slice(0, 7);
  const admin = createAdminClient();
  let rows = await getWageRows(admin, ym);

  if (filter === "missing-bank") rows = rows.filter((r) => !r.bank || !r.bank.verified_at);
  if (filter === "missing-wage")
    rows = rows.filter((r) => r.monthlyWage == null && r.profile.work_type !== "intern_unpaid");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Gaji — dashboard owner</h1>
        <form method="get" className="flex gap-2">
          <input type="month" name="month" defaultValue={ym} className="input !w-auto" />
          <select name="filter" defaultValue={filter ?? ""} className="input !w-auto">
            <option value="">semua</option>
            <option value="missing-bank">bank belum/unverified</option>
            <option value="missing-wage">gaji belum diisi</option>
          </select>
          <button className="btn-secondary text-xs">Terapkan</button>
        </form>
      </div>

      {/* Permanent estimation banner (§4.6) */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ Estimasi — bukan slip gaji resmi; tidak termasuk pajak/BPJS/tunjangan/lembur. Rate harian
        = gaji ÷ hari kerja; hanya <b>unpaid leave yang disetujui</b> yang memotong.
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="data min-w-[980px]">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Hadir/Telat</th>
              <th>Cuti/Unpaid</th>
              <th>Gaji bulanan</th>
              <th>Potongan</th>
              <th>Estimasi</th>
              <th>Bank (full — owner only)</th>
              <th>Bagikan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isUnpaidIntern = r.profile.work_type === "intern_unpaid";
              return (
                <tr key={r.profile.id} className={isUnpaidIntern ? "opacity-50" : ""}>
                  <td>
                    <p className="font-medium">{r.profile.full_name}</p>
                    <p className="text-xs text-neutral-400">
                      {r.profile.departments?.name ?? "—"}
                      {isUnpaidIntern && (
                        <span className="ml-1 chip bg-neutral-100 text-neutral-500">unpaid intern</span>
                      )}
                    </p>
                  </td>
                  <td>
                    {r.attendance.present}/{r.attendance.late}
                  </td>
                  <td>
                    {r.attendance.annual}/{r.attendance.unpaid}
                  </td>
                  <td>{r.monthlyWage != null ? formatRupiah(r.monthlyWage) : <span className="text-red-500">belum diisi</span>}</td>
                  <td>{r.deduction ? formatRupiah(r.deduction) : "—"}</td>
                  <td className="font-semibold">{r.estimate != null ? formatRupiah(r.estimate) : "—"}</td>
                  <td>
                    {r.bank ? (
                      <ReceiptShare
                        mode="copy-account"
                        accountText={`${r.bank.bank_name} ${r.bank.account_number} a.n. ${r.bank.account_holder_name}`}
                        unconfirmed={!r.bank.confirmed_by_employee}
                      />
                    ) : (
                      <span className="text-red-500">❌ belum ada</span>
                    )}
                  </td>
                  <td>
                    {!isUnpaidIntern && r.monthlyWage != null && (
                      <ReceiptShare
                        mode="receipt"
                        profileId={r.profile.id}
                        ym={ym}
                        phone={r.profile.phone}
                        maskedText={buildReceiptText(r, ym)}
                        fullText={buildReceiptText(r, ym, { includeFullAccount: true })}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400">
        Setiap export rincian gaji tercatat di audit log (siapa, untuk siapa, kapan). Nomor rekening
        dimask di teks share secara default — WhatsApp bisa di-forward.
      </p>
    </div>
  );
}
