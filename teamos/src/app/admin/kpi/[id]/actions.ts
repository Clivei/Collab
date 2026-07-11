"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import type { KpiAssignment } from "@/lib/types";

export async function saveScoresAction(formData: FormData) {
  const { profile: me } = await requireManager();
  const assignmentId = String(formData.get("assignment_id"));
  const admin = createAdminClient();

  const { data: a } = await admin.from("kpi_assignments").select("*").eq("id", assignmentId).single();
  if (!a || a.status === "revoked") return;
  const assignment = a as KpiAssignment;

  const scores = assignment.metrics
    .map((m) => ({
      metric_key: m.metric_key,
      score_0_100: Number(formData.get(`score_${m.metric_key}`)),
      note: String(formData.get(`note_${m.metric_key}`) || "") || undefined,
    }))
    .filter((s) => !Number.isNaN(s.score_0_100) && formData.get(`score_${s.metric_key}`) !== "");
  const overall = String(formData.get("overall_note") || "") || null;

  const { data: existing } = await admin
    .from("kpi_entries")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status === "draft") {
    await admin
      .from("kpi_entries")
      .update({ scores, overall_note: overall, entered_by: me.id })
      .eq("id", existing.id);
  } else {
    await admin.from("kpi_entries").insert({
      assignment_id: assignmentId,
      scores,
      overall_note: overall,
      entered_by: me.id,
      status: "draft",
    });
  }
  revalidatePath(`/admin/kpi/${assignmentId}`);
}

export async function shareEntryAction(formData: FormData) {
  await requireManager();
  const entryId = String(formData.get("entry_id"));
  const assignmentId = String(formData.get("assignment_id"));
  const admin = createAdminClient();

  await admin
    .from("kpi_entries")
    .update({ status: "shared_with_employee", shared_at: new Date().toISOString() })
    .eq("id", entryId);
  await admin.from("kpi_assignments").update({ status: "completed" }).eq("id", assignmentId).eq("status", "active");

  const { data: a } = await admin.from("kpi_assignments").select("profile_id").eq("id", assignmentId).single();
  if (a) {
    await sendPushToProfile(admin, a.profile_id, {
      title: "📊 Hasil KPI kamu",
      body: "Skor KPI kamu sudah dishare — buka untuk melihat.",
      url: "/kpi",
    });
  }
  revalidatePath(`/admin/kpi/${assignmentId}`);
  revalidatePath("/admin/kpi");
}

export async function revokeAssignmentAction(formData: FormData) {
  const { profile: me } = await requireManager();
  const assignmentId = String(formData.get("assignment_id"));
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return; // reason required (§4.5)
  const admin = createAdminClient();

  const { data: a } = await admin
    .from("kpi_assignments")
    .select("profile_id, status")
    .eq("id", assignmentId)
    .single();
  if (!a || a.status !== "active") return;

  await admin
    .from("kpi_assignments")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: me.id,
      revoke_reason: reason,
    })
    .eq("id", assignmentId);

  await sendPushToProfile(admin, a.profile_id, {
    title: "KPI dicabut",
    body: "Salah satu KPI box kamu dicabut oleh manajer.",
    url: "/kpi",
  });
  revalidatePath(`/admin/kpi/${assignmentId}`);
  revalidatePath("/admin/kpi");
}
