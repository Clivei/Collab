"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { countWorkingDays } from "@/lib/tz";

const IZIN_TYPES = ["izin_late", "izin_early"];

export async function submitLeaveAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const type = String(formData.get("type"));
  const start = String(formData.get("start_date"));
  const end = String(formData.get("end_date") || start);
  const izinTime = String(formData.get("izin_time") || "");
  const reason = String(formData.get("reason") || "");

  // Policy defaults (§3.7): izin_late/izin_early = 0 days; half_day = 0.5; else weekday count.
  let days: number;
  if (IZIN_TYPES.includes(type)) days = 0;
  else if (type === "half_day") days = 0.5;
  else days = countWorkingDays(start, end);

  await supabase.from("leave_requests").insert({
    profile_id: profile.id,
    type,
    start_date: start,
    end_date: IZIN_TYPES.includes(type) || type === "half_day" ? start : end,
    days,
    izin_time: izinTime || null,
    reason: reason || null,
  });
  revalidatePath("/leave");
}

export async function cancelLeaveAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", String(formData.get("id")))
    .eq("profile_id", profile.id)
    .eq("status", "pending");
  revalidatePath("/leave");
}
