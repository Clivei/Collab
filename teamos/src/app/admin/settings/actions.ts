"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveEntityAction(formData: FormData) {
  await requireOwner();
  const admin = createAdminClient();
  await admin
    .from("entities")
    .update({
      office_lat: Number(formData.get("office_lat")),
      office_lng: Number(formData.get("office_lng")),
      geofence_radius_m: Number(formData.get("geofence_radius_m")),
      work_start_time: String(formData.get("work_start_time")),
      work_end_time: String(formData.get("work_end_time")),
      late_grace_min: Number(formData.get("late_grace_min")),
      working_days_per_month: Number(formData.get("working_days_per_month")),
      manager_recap_enabled: formData.get("manager_recap_enabled") === "on",
    })
    .eq("id", String(formData.get("entity_id")));
  revalidatePath("/admin/settings");
}
