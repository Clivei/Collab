"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { wibDateStr } from "@/lib/tz";

/** §4.10 inline bank entry — owner/manager types details on the employee's behalf. */
export async function adminSaveBankAction(formData: FormData) {
  const { supabase, profile } = await requireManager();
  const profileId = String(formData.get("profile_id"));
  const bank_name = String(formData.get("bank_name"));
  const account_number = String(formData.get("account_number")).replace(/\s/g, "");
  const account_holder_name = String(formData.get("account_holder_name"));
  if (!bank_name || !account_number || !account_holder_name) return;

  await supabase.from("bank_accounts").update({ is_active: false }).eq("profile_id", profileId).eq("is_active", true);
  await supabase.from("bank_accounts").insert({
    profile_id: profileId,
    bank_name,
    account_number,
    account_holder_name,
    entered_by: profile.id,          // who typed it
    confirmed_by_employee: false,    // employee confirms with one tap later
  });
  revalidatePath("/admin");
}

export async function verifyBankAction(formData: FormData) {
  const { supabase, profile } = await requireManager();
  await supabase
    .from("bank_accounts")
    .update({ verified_by: profile.id, verified_at: new Date().toISOString() })
    .eq("id", String(formData.get("bank_id")));
  revalidatePath("/admin");
}

export async function setWageAction(formData: FormData) {
  const { supabase } = await requireOwner();
  const profileId = String(formData.get("profile_id"));
  const wage = Number(String(formData.get("monthly_wage")).replace(/[^\d]/g, ""));
  if (!wage) return;
  await supabase.from("wages").insert({
    profile_id: profileId,
    monthly_wage: wage,
    effective_from: String(formData.get("effective_from") || wibDateStr()),
  });
  revalidatePath("/admin");
  revalidatePath("/admin/wages");
}

/** not_started → active: attendance expectations start from that day (#31). */
export async function activateEmployeeAction(formData: FormData) {
  const { supabase } = await requireManager();
  await supabase
    .from("profiles")
    .update({ employment_status: "active", start_date: wibDateStr() })
    .eq("id", String(formData.get("profile_id")));
  // create the seeded onboarding task if missing
  const admin = createAdminClient();
  const profileId = String(formData.get("profile_id"));
  const { data: existing } = await admin
    .from("onboarding_tasks")
    .select("id")
    .eq("profile_id", profileId)
    .eq("title", "Isi data rekening bank")
    .maybeSingle();
  const { data: bank } = await admin
    .from("bank_accounts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (!existing && !bank) {
    await admin.from("onboarding_tasks").insert({
      profile_id: profileId,
      title: "Isi data rekening bank",
      assignee: "employee",
    });
  }
  revalidatePath("/admin");
}

/** Quick action: intern → fulltime (prompts contract flow via people page). */
export async function internToFulltimeAction(formData: FormData) {
  const { supabase } = await requireManager();
  await supabase
    .from("profiles")
    .update({ work_type: "fulltime", intern_start: null, intern_end: null })
    .eq("id", String(formData.get("profile_id")));
  revalidatePath("/admin");
}

export async function updateProfileAdminAction(formData: FormData) {
  const { supabase } = await requireManager();
  const id = String(formData.get("profile_id"));
  const patch: Record<string, unknown> = {};
  for (const key of ["badge", "notes", "phone", "work_type", "employment_status"]) {
    const v = formData.get(key);
    if (v !== null && String(v) !== "") patch[key] = String(v);
  }
  for (const key of ["intern_start", "intern_end", "start_date"]) {
    const v = formData.get(key);
    if (v !== null) patch[key] = String(v) || null;
  }
  if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("id", id);
  revalidatePath("/admin");
  revalidatePath(`/admin/people/${id}`);
}
