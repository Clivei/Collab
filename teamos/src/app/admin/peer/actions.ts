"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PEER_CATEGORIES } from "@/lib/types";

/**
 * Create a draft cycle with the 5-category snapshot and auto-assigned raters:
 * 3–5 per person from real working relationships (same department first,
 * cross-entity allowed), never self.
 */
export async function createCycleAction(formData: FormData) {
  await requireManager();
  const admin = createAdminClient();

  const name = String(formData.get("name"));
  const opens = String(formData.get("opens_at"));
  const closes = String(formData.get("closes_at"));
  if (!name || !opens || !closes) return;

  const { data: cycle } = await admin
    .from("peer_review_cycles")
    .insert({
      name,
      opens_at: `${opens}T00:00:00+07:00`,
      closes_at: `${closes}T23:59:59+07:00`,
      status: "draft",
      categories: PEER_CATEGORIES, // snapshot so past cycles stay comparable
    })
    .select("id")
    .single();
  if (!cycle) return;

  const { data: people } = await admin
    .from("profiles")
    .select("id, department_id")
    .eq("employment_status", "active")
    .neq("permission", "owner");
  const list = people ?? [];

  const requests: { cycle_id: string; rater_id: string; ratee_id: string }[] = [];
  for (const ratee of list) {
    const sameDept = list.filter((p) => p.id !== ratee.id && p.department_id === ratee.department_id);
    const others = list.filter((p) => p.id !== ratee.id && p.department_id !== ratee.department_id);
    const raters = [...sameDept, ...others].slice(0, 4); // 3–5 target; take up to 4
    for (const rater of raters) {
      requests.push({ cycle_id: cycle.id, rater_id: rater.id, ratee_id: ratee.id });
    }
  }
  if (requests.length) await admin.from("peer_review_requests").insert(requests);

  revalidatePath("/admin/peer");
  redirect(`/admin/peer/${cycle.id}`);
}
