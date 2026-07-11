"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMonthlyReport } from "@/lib/report";

export async function generateReportAction(formData: FormData) {
  await requireManager();
  const ym = String(formData.get("month"));
  const entityId = String(formData.get("entity_id") || "") || null;
  if (!ym) return;
  const admin = createAdminClient();
  await generateMonthlyReport(admin, ym, entityId);
  revalidatePath("/admin/reports");
}
