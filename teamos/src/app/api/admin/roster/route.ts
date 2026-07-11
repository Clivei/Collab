import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskAccount } from "@/lib/types";

export async function GET() {
  const { profile } = await getProfile();
  if (!profile || profile.permission === "employee") {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createAdminClient();
  const [{ data: profiles }, { data: banks }] = await Promise.all([
    admin
      .from("profiles")
      .select("*, departments(name), entities(name), roles(name)")
      .neq("permission", "owner")
      .order("full_name"),
    admin.from("bank_accounts").select("profile_id, bank_name, account_number").eq("is_active", true),
  ]);
  const bankOf = new Map((banks ?? []).map((b) => [b.profile_id, b]));

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["name", "department", "entity", "role", "badge", "work_type", "status", "intern_start", "intern_end", "phone", "bank", "leave_balance"].join(","),
    ...(profiles ?? []).map((p) =>
      [
        esc(p.full_name),
        esc(p.departments?.name),
        esc(p.entities?.name ?? "Both"),
        esc(p.roles?.name),
        esc(p.badge),
        esc(p.work_type),
        esc(p.employment_status),
        esc(p.intern_start),
        esc(p.intern_end),
        esc(p.phone),
        esc(
          bankOf.has(p.id)
            ? `${bankOf.get(p.id)!.bank_name} ${maskAccount(bankOf.get(p.id)!.account_number)}`
            : "missing"
        ),
        esc(Number(p.leave_balance_annual) + Number(p.leave_balance_carryover)),
      ].join(",")
    ),
  ];
  return new Response(rows.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="teamos-roster.csv"`,
    },
  });
}
