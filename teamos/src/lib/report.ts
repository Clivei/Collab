import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthAttendance } from "@/lib/attendance-summary";
import { getKpiAssistant } from "@/lib/ai/adapter";
import { monthLabelID, wibDateStr, wibMonthBounds } from "@/lib/tz";
import type { KpiAssignment, KpiEntry } from "@/lib/types";

export function weightedTotal(assignment: KpiAssignment, entry: KpiEntry | null): number | null {
  if (!entry) return null;
  const weights = new Map(assignment.metrics.map((m) => [m.metric_key, m.weight]));
  let total = 0;
  for (const s of entry.scores) {
    total += (s.score_0_100 * (weights.get(s.metric_key) ?? 0)) / 100;
  }
  return Math.round(total * 10) / 10;
}

/**
 * §4.9 server-side aggregation → data_snapshot.
 * Per-person monthly aggregates ONLY — no selfie paths, no raw peer comments,
 * no bank account numbers ever reach the model.
 */
export async function buildReportSnapshot(
  admin: SupabaseClient,
  ym: string,
  entityId: string | null
): Promise<Record<string, unknown>> {
  const { start, end } = wibMonthBounds(ym);
  const today = wibDateStr();

  let profileQuery = admin
    .from("profiles")
    .select("*, departments(name), entities(name)")
    .neq("permission", "owner");
  if (entityId) profileQuery = profileQuery.eq("entity_id", entityId);
  const { data: profiles } = await profileQuery;

  const ids = (profiles ?? []).map((p) => p.id);
  const [{ data: assignments }, { data: entries }, { data: banks }, { data: contracts }, { data: cycles }] =
    await Promise.all([
      admin.from("kpi_assignments").select("*").in("profile_id", ids),
      admin.from("kpi_entries").select("*"),
      admin.from("bank_accounts").select("profile_id, confirmed_by_employee, verified_at").eq("is_active", true),
      admin.from("contracts").select("profile_id, status, end_date"),
      admin
        .from("peer_review_cycles")
        .select("*")
        .eq("status", "published")
        .order("closes_at", { ascending: false })
        .limit(2),
    ]);

  const entriesByAssignment = new Map<string, KpiEntry[]>();
  for (const e of (entries ?? []) as KpiEntry[]) {
    const list = entriesByAssignment.get(e.assignment_id) ?? [];
    list.push(e);
    entriesByAssignment.set(e.assignment_id, list);
  }

  // latest published peer cycle aggregates (≥3 raters floor)
  const peerAverages = new Map<string, number>();
  const prevPeerAverages = new Map<string, number>();
  const cycleList = cycles ?? [];
  for (let i = 0; i < cycleList.length; i++) {
    const target = i === 0 ? peerAverages : prevPeerAverages;
    const { data: reqs } = await admin
      .from("peer_review_requests")
      .select("id, ratee_id, status")
      .eq("cycle_id", cycleList[i].id)
      .eq("status", "submitted");
    const { data: reviews } = await admin
      .from("peer_reviews")
      .select("request_id, scores")
      .in("request_id", (reqs ?? []).map((r) => r.id));
    const reviewByReq = new Map((reviews ?? []).map((r) => [r.request_id, r]));
    const byRatee = new Map<string, number[]>();
    for (const req of reqs ?? []) {
      const review = reviewByReq.get(req.id);
      if (!review) continue;
      const scores = (review.scores as { score_1_5: number }[]).map((s) => s.score_1_5);
      const avg = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);
      const list = byRatee.get(req.ratee_id) ?? [];
      list.push(avg);
      byRatee.set(req.ratee_id, list);
    }
    for (const [ratee, avgs] of byRatee) {
      if (avgs.length >= 3) {
        target.set(ratee, Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100);
      }
    }
  }

  const bankByProfile = new Map((banks ?? []).map((b) => [b.profile_id, b]));
  const contractsByProfile = new Map<string, { status: string; end_date: string | null }[]>();
  for (const c of contracts ?? []) {
    const list = contractsByProfile.get(c.profile_id) ?? [];
    list.push(c);
    contractsByProfile.set(c.profile_id, list);
  }

  const people: Record<string, unknown>[] = [];
  for (const p of profiles ?? []) {
    const attendance =
      p.employment_status === "active" ? await getMonthAttendance(admin, p.id, start, end) : null;
    const myAssignments = ((assignments ?? []) as KpiAssignment[]).filter(
      (a) => a.profile_id === p.id
    );
    const kpi = myAssignments.map((a) => {
      const latest = (entriesByAssignment.get(a.id) ?? []).sort((x, y) =>
        (y.shared_at ?? "") > (x.shared_at ?? "") ? 1 : -1
      )[0];
      return {
        period: `${a.period_start}..${a.period_end}`,
        status: a.status,
        weighted_total: weightedTotal(a, latest ?? null),
      };
    });
    const internDaysRemaining =
      p.intern_end && p.intern_end >= today
        ? Math.round((new Date(p.intern_end).getTime() - new Date(today).getTime()) / 86400000)
        : null;
    const bank = bankByProfile.get(p.id);
    const peerAvg = peerAverages.get(p.id) ?? null;
    const prevPeer = prevPeerAverages.get(p.id) ?? null;

    people.push({
      name: p.full_name,
      department: p.departments?.name ?? null,
      entity: p.entities?.name ?? "Both",
      work_type: p.work_type,
      employment_status: p.employment_status,
      attendance,
      leave_balance_annual: p.leave_balance_annual,
      kpi,
      peer_latest_avg: peerAvg,
      peer_delta: peerAvg != null && prevPeer != null ? Math.round((peerAvg - prevPeer) * 100) / 100 : null,
      intern_days_remaining: internDaysRemaining,
      missing_bank: !bank,
      bank_unconfirmed: bank ? !bank.confirmed_by_employee : false,
      missing_contract: !(contractsByProfile.get(p.id) ?? []).length,
    });
  }

  const { count: unsharedDrafts } = await admin
    .from("kpi_entries")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: unmoderatedComments } = await admin
    .from("peer_reviews")
    .select("id", { count: "exact", head: true })
    .eq("comment_moderation", "pending")
    .not("comment", "is", null);

  return {
    period: ym,
    entity: entityId,
    people,
    hygiene: {
      unshared_kpi_drafts: unsharedDrafts ?? 0,
      unmoderated_peer_comments: unmoderatedComments ?? 0,
      missing_bank: people.filter((x) => x.missing_bank).map((x) => x.name),
    },
  };
}

/** Generate + store one report row (immutable; regeneration bumps version). */
export async function generateMonthlyReport(
  admin: SupabaseClient,
  ym: string,
  entityId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const assistant = getKpiAssistant();
  if (!assistant) return { ok: false, error: "AI_PROVIDER off / no API key" };

  const snapshot = await buildReportSnapshot(admin, ym, entityId);
  const content = await assistant.generateMonthlyReport(snapshot, monthLabelID(ym));

  const { data: existing } = await admin
    .from("monthly_reports")
    .select("version")
    .eq("period_month", `${ym}-01`)
    .is("entity_id", entityId)
    .order("version", { ascending: false })
    .limit(1);
  const version = existing?.length ? existing[0].version + 1 : 1;

  const { error } = await admin.from("monthly_reports").insert({
    entity_id: entityId,
    period_month: `${ym}-01`,
    version,
    content_md: content,
    data_snapshot: snapshot,
    model: assistant.model,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
