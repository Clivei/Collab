import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-ratee average score for a cycle, with the ≥3-submitted-raters anonymity
 * floor (PRD §4.8 step 3). Below the floor a ratee simply has no entry.
 */
export async function getPeerAverages(
  admin: SupabaseClient,
  cycleId: string
): Promise<Map<string, number>> {
  const { data: reqs } = await admin
    .from("peer_review_requests")
    .select("id, ratee_id")
    .eq("cycle_id", cycleId)
    .eq("status", "submitted");
  const reqIds = (reqs ?? []).map((r) => r.id);
  if (!reqIds.length) return new Map();

  const { data: reviews } = await admin
    .from("peer_reviews")
    .select("request_id, scores")
    .in("request_id", reqIds);
  const reviewByReq = new Map((reviews ?? []).map((r) => [r.request_id, r]));

  const byRatee = new Map<string, number[]>();
  for (const req of reqs ?? []) {
    const review = reviewByReq.get(req.id);
    if (!review) continue;
    const scores = (review.scores as { score_1_5: number }[]).map((s) => s.score_1_5);
    if (!scores.length) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const list = byRatee.get(req.ratee_id) ?? [];
    list.push(avg);
    byRatee.set(req.ratee_id, list);
  }

  const result = new Map<string, number>();
  for (const [ratee, avgs] of byRatee) {
    if (avgs.length >= 3) {
      result.set(ratee, Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100);
    }
  }
  return result;
}

export async function getLatestPublishedCycle(admin: SupabaseClient) {
  const { data } = await admin
    .from("peer_review_cycles")
    .select("*")
    .eq("status", "published")
    .order("closes_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
