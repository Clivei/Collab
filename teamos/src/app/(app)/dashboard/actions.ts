"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export async function confirmBankAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  await supabase
    .from("bank_accounts")
    .update({ confirmed_by_employee: true })
    .eq("id", String(formData.get("bank_id")))
    .eq("profile_id", profile.id);
  revalidatePath("/dashboard");
}

export async function completeOnboardingTaskAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  await supabase
    .from("onboarding_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", String(formData.get("task_id")))
    .eq("profile_id", profile.id);
  revalidatePath("/dashboard");
}
