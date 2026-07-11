import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import type { KpiAssignmentMetric } from "@/lib/types";

export async function POST(request: Request) {
  const { profile: me } = await getProfile();
  if (!me || me.permission === "employee") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const metrics = (body.metrics ?? []) as KpiAssignmentMetric[];

  // Acceptance #17: weights must sum to exactly 100 — blocked at send.
  const weightSum = metrics.reduce((a, m) => a + Number(m.weight || 0), 0);
  if (!metrics.length || weightSum !== 100) {
    return NextResponse.json({ error: `bobot harus 100 (sekarang ${weightSum})` }, { status: 400 });
  }
  for (const m of metrics) {
    if (!m.metric_key || !m.label) {
      return NextResponse.json({ error: "metrik tidak lengkap" }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("kpi_assignments").insert({
    profile_id: body.profile_id,
    assigned_by: me.id,
    period_start: body.period_start,
    period_end: body.period_end,
    metrics,
    status: "active",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // audit which AI suggestions were accepted (§3.12)
  if (body.log_id) {
    await admin
      .from("ai_suggestions_log")
      .update({ accepted: body.accepted ?? [] })
      .eq("id", body.log_id);
  }

  await sendPushToProfile(admin, body.profile_id, {
    title: "🎯 KPI baru untukmu",
    body: "Ini target kamu bulan ini — buka untuk lihat metrik & target.",
    url: "/kpi",
  });

  return NextResponse.json({ ok: true });
}
