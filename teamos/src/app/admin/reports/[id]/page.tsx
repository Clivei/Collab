import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthLabelID } from "@/lib/tz";

/** Minimal markdown rendering: headings, bold, lists, paragraphs. */
function renderMd(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: number) => {
    if (list.length) {
      out.push(
        <ul key={`ul${key}`} className="mb-3 list-disc space-y-1 pl-5 text-sm">
          {list.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
          ))}
        </ul>
      );
      list = [];
    }
  };
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("## ")) {
      flush(i);
      out.push(
        <h2 key={i} className="mb-2 mt-5 text-base font-bold">
          {t.slice(3)}
        </h2>
      );
    } else if (t.startsWith("# ")) {
      flush(i);
      out.push(
        <h1 key={i} className="mb-2 mt-4 text-lg font-bold">
          {t.slice(2)}
        </h1>
      );
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      list.push(t.slice(2));
    } else if (t === "") {
      flush(i);
    } else {
      flush(i);
      out.push(
        <p key={i} className="mb-2 text-sm" dangerouslySetInnerHTML={{ __html: inline(t) }} />
      );
    }
  });
  flush(lines.length);
  return out;
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile: me } = await requireManager();
  const { id } = await params;
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("monthly_reports")
    .select("*, entities(name)")
    .eq("id", id)
    .single();
  if (!report) notFound();

  // mark read
  const readBy: string[] = Array.isArray(report.read_by) ? report.read_by : [];
  if (!readBy.includes(me.id)) {
    await admin
      .from("monthly_reports")
      .update({ read_by: [...readBy, me.id] })
      .eq("id", id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/reports" className="text-sm text-neutral-400 hover:text-emerald-600">
        ← Laporan
      </Link>
      <h1 className="text-xl font-bold">
        Laporan {monthLabelID(report.period_month.slice(0, 7))} —{" "}
        {(report.entities as { name: string } | null)?.name ?? "Gabungan"}
        <span className="ml-2 text-sm font-normal text-neutral-400">v{report.version}</span>
      </h1>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ Analisis otomatis — verifikasi sebelum mengambil tindakan.
      </div>
      <div className="card">{renderMd(report.content_md)}</div>
      <p className="text-xs text-neutral-400">
        Model: {report.model} · dibuat {report.generated_at.slice(0, 16).replace("T", " ")} UTC
      </p>
    </div>
  );
}
