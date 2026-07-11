import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKpiAssistant } from "@/lib/ai/adapter";
import { getMonthAttendance } from "@/lib/attendance-summary";
import { weightedTotal } from "@/lib/report";
import { wibMonthBounds } from "@/lib/tz";
import type { KpiAssignment, KpiEntry, KpiMetricDef } from "@/lib/types";

/** §4.5 "Saran AI" — one server-side LLM call; call + acceptance logged. */
export async function POST(request: Request) {
  const { profile: me } = await getProfile();
  if (!me || me.permission === "employee") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const assistant = getKpiAssistant();
  if (!assistant) {
    return NextResponse.json({ error: "AI dimatikan (AI_PROVIDER=off atau API key kosong)" }, { status: 503 });
  }

  const { profile_id } = await request.json();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("*, roles(name, kpi_rubric)")
    .eq("id", profile_id)
    .single();
  if (!target) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  const { data: past } = await admin
    .from("kpi_assignments")
    .select("*")
    .eq("profile_id", profile_id)
    .order("period_start", { ascending: false })
    .limit(3);
  const pastIds = (past ?? []).map((a) => a.id);
  const { data: pastEntries } = pastIds.length
    ? await admin.from("kpi_entries").select("*").in("assignment_id", pastIds)
    : { data: [] };

  const pastAssignments = ((past ?? []) as KpiAssignment[]).map((a) => ({
    period: `${a.period_start}..${a.period_end}`,
    status: a.status,
    metrics: a.metrics.map((m) => ({ key: m.metric_key, label: m.label, target: m.target, weight: m.weight })),
    weighted_total: weightedTotal(
      a,
      ((pastEntries ?? []) as KpiEntry[]).find((e) => e.assignment_id === a.id) ?? null
    ),
  }));

  const { start, end } = wibMonthBounds();
  const attendanceSummary =
    target.employment_status === "active" ? await getMonthAttendance(admin, profile_id, start, end) : null;

  const role = target.roles as unknown as { name: string; kpi_rubric: KpiMetricDef[] } | null;
  const input = {
    roleName: role?.name ?? "Belum ada role",
    roleLibrary: role?.kpi_rubric ?? [],
    pastAssignments,
    attendanceSummary,
  };

  try {
    const { suggestions } = await assistant.suggestMetrics(input);
    const { data: log } = await admin
      .from("ai_suggestions_log")
      .insert({
        context: { ...input, employee: target.full_name, model: assistant.model },
        suggestions,
        requested_by: me.id,
      })
      .select("id")
      .single();
    return NextResponse.json({ suggestions, log_id: log?.id ?? null });
  } catch (err) {
    return NextResponse.json({ error: `AI gagal: ${String(err)}` }, { status: 502 });
  }
}
