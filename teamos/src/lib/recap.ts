import type { SupabaseClient } from "@supabase/supabase-js";
import { getDaySummary } from "@/lib/attendance-summary";
import { dateLabelID } from "@/lib/tz";

/**
 * §4.11 Daily WhatsApp recap — names + attendance status only.
 * Never wages, bank data, KPI, or peer scores (it's a WhatsApp message;
 * assume it can be forwarded).
 */
export async function buildDailyRecap(admin: SupabaseClient, dateStr: string): Promise<string> {
  const s = await getDaySummary(admin, dateStr);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://teamos.norapadel.my.id";

  const listNames = (items: string[]) => (items.length ? ` — ${items.join(", ")}` : "");
  const lateList = s.late.length
    ? ` — ${s.late.map((l) => `${l.name} ${l.time}`).join(", ")}`
    : "";
  const izinList = s.izin.length
    ? ` — ${s.izin.map((i) => `${i.name} (${i.type})`).join(", ")}`
    : "";
  const cutiList = s.cuti.length ? ` — ${s.cuti.map((c) => c.name).join(", ")}` : "";
  const rejectedList = s.rejected.length
    ? ` — ${s.rejected.map((r) => `${r.name}${r.distance != null ? `, ${Math.round(r.distance)} m` : ""}, ${r.time}`).join("; ")}`
    : "";

  return [
    `📋 TeamOS — Rekap ${dateLabelID(dateStr)}`,
    "NoraPadel + Gridline",
    "--------------------------------",
    `✅ Hadir     : ${s.present.length}`,
    `⏰ Telat     : ${s.late.length}${lateList}`,
    `📝 Izin      : ${s.izin.length}${izinList}`,
    `🌴 Cuti      : ${s.cuti.length}${cutiList}`,
    `❌ Tanpa ket.: ${s.absent.length}${listNames(s.absent)}`,
    `🚫 Ditolak geofence: ${s.rejected.length}${rejectedList}`,
    `⚠️ Spoof flag: ${s.spoofFlagged.length}${listNames(s.spoofFlagged)}`,
    `🕔 Belum clock-out: ${s.notClockedOut.length}${s.notClockedOut.length ? " (reminder terkirim)" : ""}`,
    "--------------------------------",
    `Buka dashboard: ${appUrl}/admin`,
  ].join("\n");
}
