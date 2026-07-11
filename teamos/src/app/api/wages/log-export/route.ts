import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** §4.6: every receipt export is audit-logged (who, whom, when, masked?). */
export async function POST(request: Request) {
  const { profile } = await getProfile();
  if (!profile || profile.permission !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { profile_id, ym, masked } = await request.json();
  if (!profile_id || !ym) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const admin = createAdminClient();
  await admin.from("wage_export_log").insert({
    exported_by: profile.id,
    profile_id,
    period_month: `${ym}-01`,
    masked: masked !== false,
  });
  return NextResponse.json({ ok: true });
}
