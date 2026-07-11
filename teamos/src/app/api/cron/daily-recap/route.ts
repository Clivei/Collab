import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyRecap } from "@/lib/recap";
import { sendWhatsApp } from "@/lib/wa";
import { isWeekendWIB, wibDateStr } from "@/lib/tz";

export const dynamic = "force-dynamic";

/**
 * §4.11 daily WhatsApp recap at work_end_time + 30 min WIB, working days only.
 * Same queries as the manager grid — the numbers can't disagree. Also piggy-
 * backs the 90-day selfie cleanup (§7.3).
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isWeekendWIB()) return NextResponse.json({ skipped: "weekend" });

  const admin = createAdminClient();
  const today = wibDateStr();
  const recap = await buildDailyRecap(admin, today);

  const results: Record<string, boolean> = {};
  const ownerNumber = process.env.OWNER_WA_NUMBER;
  if (ownerNumber) {
    results.owner = await sendWhatsApp("daily_recap", ownerNumber, recap);
  }

  // Optional per-manager recaps (Settings toggle)
  const { data: entities } = await admin.from("entities").select("id, manager_recap_enabled");
  const enabledEntityIds = (entities ?? []).filter((e) => e.manager_recap_enabled).map((e) => e.id);
  if (enabledEntityIds.length) {
    const { data: managers } = await admin
      .from("profiles")
      .select("id, phone, entity_id")
      .eq("permission", "manager")
      .not("phone", "is", null);
    for (const m of managers ?? []) {
      if (m.entity_id && !enabledEntityIds.includes(m.entity_id)) continue;
      results[`manager_${m.id}`] = await sendWhatsApp("daily_recap", m.phone!, recap);
    }
  }

  // 90-day selfie retention
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const { data: oldRecords } = await admin
    .from("attendance_records")
    .select("id, selfie_in_path, selfie_out_path")
    .lt("work_date", cutoff)
    .or("selfie_in_path.not.is.null,selfie_out_path.not.is.null")
    .limit(200);
  const paths = (oldRecords ?? [])
    .flatMap((r) => [r.selfie_in_path, r.selfie_out_path])
    .filter((p): p is string => !!p);
  if (paths.length) {
    await admin.storage.from("selfies").remove(paths);
    for (const r of oldRecords ?? []) {
      await admin
        .from("attendance_records")
        .update({ selfie_in_path: null, selfie_out_path: null })
        .eq("id", r.id);
    }
  }

  return NextResponse.json({ ok: true, results, selfiesDeleted: paths.length });
}
