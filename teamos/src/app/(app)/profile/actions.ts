"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export async function saveBankAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const bank_name = String(formData.get("bank_name"));
  const account_number = String(formData.get("account_number")).replace(/\s/g, "");
  const account_holder_name = String(formData.get("account_holder_name"));
  if (!bank_name || !account_number || !account_holder_name) return;

  // Updates create a new row and deactivate the old — history preserved (§3.3).
  await supabase
    .from("bank_accounts")
    .update({ is_active: false })
    .eq("profile_id", profile.id)
    .eq("is_active", true);
  await supabase.from("bank_accounts").insert({
    profile_id: profile.id,
    bank_name,
    account_number,
    account_holder_name,
    entered_by: profile.id,
    confirmed_by_employee: true, // self-entered = confirmed
  });

  // Auto-complete the onboarding task
  await supabase
    .from("onboarding_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("profile_id", profile.id)
    .eq("title", "Isi data rekening bank")
    .eq("status", "pending");

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function updatePhoneAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const phone = String(formData.get("phone") || "").replace(/[^\d]/g, "");
  await supabase.from("profiles").update({ phone: phone || null }).eq("id", profile.id);
  revalidatePath("/profile");
}

export async function togglePushMuteAction() {
  const { supabase, profile } = await requireProfile();
  await supabase.from("profiles").update({ push_muted: !profile.push_muted }).eq("id", profile.id);
  revalidatePath("/profile");
}
