"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";

export async function openCycleAction(formData: FormData) {
  await requireManager();
  const cycleId = String(formData.get("cycle_id"));
  const admin = createAdminClient();
  await admin.from("peer_review_cycles").update({ status: "open" }).eq("id", cycleId).eq("status", "draft");

  const { data: reqs } = await admin
    .from("peer_review_requests")
    .select("rater_id")
    .eq("cycle_id", cycleId);
  const raters = [...new Set((reqs ?? []).map((r) => r.rater_id))];
  for (const raterId of raters) {
    await sendPushToProfile(admin, raterId, {
      title: "🤝 Peer assessment dibuka",
      body: "Ada rekan yang menunggu penilaianmu (≤ 3 menit per orang).",
      url: "/peer",
    });
  }
  revalidatePath(`/admin/peer/${cycleId}`);
}

export async function closeCycleAction(formData: FormData) {
  await requireManager();
  const cycleId = String(formData.get("cycle_id"));
  const admin = createAdminClient();
  await admin.from("peer_review_cycles").update({ status: "closed" }).eq("id", cycleId).eq("status", "open");
  revalidatePath(`/admin/peer/${cycleId}`);
}

export async function publishCycleAction(formData: FormData) {
  await requireManager();
  const cycleId = String(formData.get("cycle_id"));
  const admin = createAdminClient();

  // Comments stay invisible to ratees until moderated — block publish while pending.
  const { data: reqs } = await admin.from("peer_review_requests").select("id").eq("cycle_id", cycleId);
  const reqIds = (reqs ?? []).map((r) => r.id);
  if (reqIds.length) {
    const { count } = await admin
      .from("peer_reviews")
      .select("id", { count: "exact", head: true })
      .in("request_id", reqIds)
      .eq("comment_moderation", "pending")
      .not("comment", "is", null);
    if ((count ?? 0) > 0) return;
  }

  await admin.from("peer_review_cycles").update({ status: "published" }).eq("id", cycleId).eq("status", "closed");

  // notify ratees their results are ready
  const { data: allReqs } = await admin
    .from("peer_review_requests")
    .select("ratee_id")
    .eq("cycle_id", cycleId)
    .eq("status", "submitted");
  for (const rateeId of [...new Set((allReqs ?? []).map((r) => r.ratee_id))]) {
    await sendPushToProfile(admin, rateeId, {
      title: "🤝 Hasil peer assessment",
      body: "Hasil penilaian rekan (anonim) untukmu sudah tersedia.",
      url: "/peer",
    });
  }
  revalidatePath(`/admin/peer/${cycleId}`);
}

export async function moderateCommentAction(formData: FormData) {
  await requireManager();
  const reviewId = String(formData.get("review_id"));
  const decision = String(formData.get("decision"));
  if (!["approved", "redacted", "hidden"].includes(decision)) return;
  const admin = createAdminClient();
  await admin
    .from("peer_reviews")
    .update({
      comment_moderation: decision,
      redacted_comment:
        decision === "redacted" ? String(formData.get("redacted_comment") || "") : null,
    })
    .eq("id", reviewId);
  revalidatePath(`/admin/peer`);
}

export async function removeRequestAction(formData: FormData) {
  await requireManager();
  const admin = createAdminClient();
  await admin
    .from("peer_review_requests")
    .delete()
    .eq("id", String(formData.get("request_id")))
    .eq("status", "pending");
  revalidatePath(`/admin/peer/${String(formData.get("cycle_id"))}`);
}

export async function addRequestAction(formData: FormData) {
  await requireManager();
  const admin = createAdminClient();
  const rater = String(formData.get("rater_id"));
  const ratee = String(formData.get("ratee_id"));
  if (!rater || !ratee || rater === ratee) return;
  await admin.from("peer_review_requests").insert({
    cycle_id: String(formData.get("cycle_id")),
    rater_id: rater,
    ratee_id: ratee,
  });
  revalidatePath(`/admin/peer/${String(formData.get("cycle_id"))}`);
}

/** Owner-only audited unmask — the deliberately loud escape hatch (§3.16). */
export async function unmaskAction(formData: FormData) {
  const { profile: me } = await requireOwner();
  const reason = String(formData.get("reason") || "").trim();
  const cycleId = String(formData.get("cycle_id"));
  const rateeId = String(formData.get("ratee_id"));
  if (!reason || !rateeId) return;
  const admin = createAdminClient();
  await admin.from("unmask_log").insert({
    cycle_id: cycleId,
    ratee_id: rateeId,
    requested_by: me.id,
    reason,
  });
  revalidatePath(`/admin/peer/${cycleId}`);
}
