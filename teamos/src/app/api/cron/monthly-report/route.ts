import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMonthlyReport } from "@/lib/report";
import { wibDateStr } from "@/lib/tz";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** §4.9 — 1st of month: one report per entity + one combined, for last month. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const today = wibDateStr();
  const [y, m] = today.split("-").map(Number);
  const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const { data: entities } = await admin.from("entities").select("id, name");
  const results: Record<string, unknown> = {};
  for (const e of entities ?? []) {
    results[e.name] = await generateMonthlyReport(admin, prevYm, e.id);
  }
  results.combined = await generateMonthlyReport(admin, prevYm, null);
  return NextResponse.json({ ok: true, period: prevYm, results });
}
