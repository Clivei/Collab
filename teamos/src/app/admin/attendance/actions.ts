"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { countWorkingDays } from "@/lib/tz";

/** Bulk-convert unexplained absence into approved unpaid leave (feeds wage deduction). */
export async function convertAbsenceToUnpaidAction(formData: FormData) {
  const { supabase, profile } = await requireManager();
  const profileId = String(formData.get("profile_id"));
  const start = String(formData.get("start_date"));
  const end = String(formData.get("end_date") || start);
  if (!profileId || !start) return;

  await supabase.from("leave_requests").insert({
    profile_id: profileId,
    type: "unpaid",
    start_date: start,
    end_date: end,
    days: countWorkingDays(start, end),
    reason: "Konversi absen tanpa keterangan (manajer)",
    status: "approved",
    reviewed_by: profile.id,
    reviewed_at: new Date().toISOString(),
  });
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/wages");
}
