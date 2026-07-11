"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";

export async function reviewLeaveAction(formData: FormData) {
  const { supabase, profile } = await requireManager();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const note = String(formData.get("note") || "") || null;

  const admin = createAdminClient();
  const { data: req } = await admin.from("leave_requests").select("*").eq("id", id).single();
  if (!req || req.status !== "pending") return;

  if (decision === "approve") {
    // Atomic balance function — annual/half_day decrement, sick never touches
    // annual, izin approval suppresses attendance flags (§3.7).
    const { error } = await supabase.rpc("approve_leave", {
      p_request: id,
      p_reviewer: profile.id,
      p_note: note,
    });
    if (error) return;
    await sendPushToProfile(admin, req.profile_id, {
      title: "Pengajuan disetujui ✓",
      body: `${req.type} ${req.start_date} kamu disetujui.`,
      url: "/leave",
    });
  } else {
    await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq("id", id);
    await sendPushToProfile(admin, req.profile_id, {
      title: "Pengajuan ditolak",
      body: `${req.type} ${req.start_date} ditolak${note ? `: ${note}` : "."}`,
      url: "/leave",
    });
  }
  revalidatePath("/admin/leave");
}
