import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import { isWeekendWIB, wibDateStr, wibTimeStr } from "@/lib/tz";

export const dynamic = "force-dynamic";

/**
 * §4.7 job 2 — clock-out nudge at work_end_time, retry at +60 min, then set
 * the missing_clock_out flag for the manager grid. Scheduled twice (17:00 &
 * 18:00 WIB); the second firing is detected by the clock.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isWeekendWIB()) return NextResponse.json({ skipped: "weekend" });

  const admin = createAdminClient();
  const today = wibDateStr();
  const hour = Number(wibTimeStr().split(":")[0]);
  const isRetry = hour >= 18; // second firing (+60 min)

  const [{ data: records }, { data: profiles }, { data: leaves }] = await Promise.all([
    admin
      .from("attendance_records")
      .select("id, profile_id, clock_in_at, clock_out_at")
      .eq("work_date", today),
    admin
      .from("profiles")
      .select("id, push_muted")
      .eq("employment_status", "active"),
    admin
      .from("leave_requests")
      .select("profile_id, type")
      .eq("status", "approved")
      .eq("type", "izin_early")
      .lte("start_date", today)
      .gte("end_date", today),
  ]);

  const muted = new Set((profiles ?? []).filter((p) => p.push_muted).map((p) => p.id));
  const izinEarly = new Set((leaves ?? []).map((l) => l.profile_id));
  const stillIn = (records ?? []).filter(
    (r) => r.clock_in_at && !r.clock_out_at && !izinEarly.has(r.profile_id)
  );

  let sent = 0;
  for (const r of stillIn) {
    if (!muted.has(r.profile_id)) {
      sent += await sendPushToProfile(admin, r.profile_id, {
        title: "TeamOS",
        body: "🕔 Jangan lupa absen pulang.",
        url: "/attendance",
      });
    }
    if (isRetry) {
      await admin.from("attendance_records").update({ missing_clock_out: true }).eq("id", r.id);
    }
  }
  return NextResponse.json({ ok: true, sent, flagged: isRetry ? stillIn.length : 0 });
}
