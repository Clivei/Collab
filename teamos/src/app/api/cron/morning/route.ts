import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import { isWeekendWIB, wibDateStr, wibTimeStr } from "@/lib/tz";

export const dynamic = "force-dynamic";

/**
 * §4.7 job 1 — check-in nudge at entity work_start_time.
 * Only `active` employees, on working days, with no clock-in and no approved
 * leave/izin covering today. Never on weekends. Respects per-user mute.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isWeekendWIB()) return NextResponse.json({ skipped: "weekend" });

  const admin = createAdminClient();
  const today = wibDateStr();
  const nowMin = (() => {
    const [h, m] = wibTimeStr().split(":").map(Number);
    return h * 60 + m;
  })();

  const [{ data: entities }, { data: profiles }, { data: records }, { data: leaves }] =
    await Promise.all([
      admin.from("entities").select("*"),
      admin
        .from("profiles")
        .select("id, entity_id, push_muted, full_name")
        .eq("employment_status", "active")
        .neq("permission", "owner"),
      admin.from("attendance_records").select("profile_id, clock_in_at").eq("work_date", today),
      admin
        .from("leave_requests")
        .select("profile_id, type")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today),
    ]);

  const startMinOf = new Map(
    (entities ?? []).map((e) => {
      const [h, m] = String(e.work_start_time).slice(0, 5).split(":").map(Number);
      return [e.id, h * 60 + m];
    })
  );
  const defaultStart = Math.min(...[...startMinOf.values(), 9 * 60]);
  const clockedIn = new Set((records ?? []).filter((r) => r.clock_in_at).map((r) => r.profile_id));
  // full-day leave or informed izin_late = no nudge
  const excused = new Set(
    (leaves ?? [])
      .filter((l) => ["annual", "sick", "unpaid", "special", "half_day", "izin_late"].includes(l.type))
      .map((l) => l.profile_id)
  );

  let sent = 0;
  for (const p of profiles ?? []) {
    if (p.push_muted || clockedIn.has(p.id) || excused.has(p.id)) continue;
    const startMin = (p.entity_id && startMinOf.get(p.entity_id)) || defaultStart;
    if (nowMin < startMin) continue; // fire at entity start time, not before
    sent += await sendPushToProfile(admin, p.id, {
      title: "TeamOS",
      body: "⏰ Kamu belum absen masuk hari ini.",
      url: "/attendance",
    });
  }
  return NextResponse.json({ ok: true, sent });
}
