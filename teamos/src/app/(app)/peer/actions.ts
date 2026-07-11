"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import type { PeerCategory } from "@/lib/types";

export async function submitPeerReviewAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const requestId = String(formData.get("request_id"));

  const { data: req } = await supabase
    .from("peer_review_requests")
    .select("*, peer_review_cycles(categories, status)")
    .eq("id", requestId)
    .eq("rater_id", profile.id)
    .single();
  if (!req || req.status !== "pending") return;
  const cycle = req.peer_review_cycles as unknown as { categories: PeerCategory[]; status: string };
  if (cycle.status !== "open") return;

  const scores = cycle.categories.map((c) => ({
    category_key: c.category_key,
    score_1_5: Number(formData.get(`score_${c.category_key}`) ?? 3),
  }));
  const comment = String(formData.get("comment") || "").trim();

  await supabase.from("peer_reviews").insert({
    request_id: requestId,
    scores,
    comment: comment || null,
    comment_moderation: comment ? "pending" : "approved",
  });
  await supabase
    .from("peer_review_requests")
    .update({ status: "submitted" })
    .eq("id", requestId)
    .eq("rater_id", profile.id);

  revalidatePath("/peer");
}
