import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import KpiAssignBuilder from "@/components/KpiAssignBuilder";
import type { KpiMetricDef } from "@/lib/types";

export default async function AssignKpiPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  await requireManager();
  const { profile: preselect } = await searchParams;
  const admin = createAdminClient();

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, role_id, employment_status")
      .neq("permission", "owner")
      .in("employment_status", ["active", "probation", "not_started"])
      .order("full_name"),
    admin.from("roles").select("id, name, kpi_rubric"),
  ]);

  return (
    <KpiAssignBuilder
      employees={(profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name,
        roleId: p.role_id,
      }))}
      roles={(roles ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        rubric: r.kpi_rubric as KpiMetricDef[],
      }))}
      preselect={preselect ?? null}
    />
  );
}
