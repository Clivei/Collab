import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PeerCategory } from "@/lib/types";
import {
  openCycleAction,
  closeCycleAction,
  publishCycleAction,
  moderateCommentAction,
  removeRequestAction,
  addRequestAction,
  unmaskAction,
} from "./actions";

export default async function PeerCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile: me } = await requireManager();
  const isOwner = me.permission === "owner";
  const { id } = await params;
  const admin = createAdminClient();

  const { data: cycle } = await admin.from("peer_review_cycles").select("*").eq("id", id).single();
  if (!cycle) notFound();
  const categories = cycle.categories as PeerCategory[];

  const [{ data: requests }, { data: profiles }, { data: unmasks }] = await Promise.all([
    admin.from("peer_review_requests").select("*").eq("cycle_id", id),
    admin.from("profiles").select("id, full_name").neq("permission", "owner"),
    admin.from("unmask_log").select("*").eq("cycle_id", id),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const reqs = requests ?? [];
  const reqIds = reqs.map((r) => r.id);
  const { data: reviews } = reqIds.length
    ? await admin.from("peer_reviews").select("*").in("request_id", reqIds)
    : { data: [] };
  const reviewByReq = new Map((reviews ?? []).map((r) => [r.request_id, r]));

  // Aggregates per ratee, ≥3-rater floor + outlier detection (>2 pts from other raters' mean)
  const byRatee = new Map<string, { reqId: string; raterId: string; avg: number }[]>();
  for (const r of reqs) {
    if (r.status !== "submitted") continue;
    const review = reviewByReq.get(r.id);
    if (!review) continue;
    const scores = (review.scores as { score_1_5: number }[]).map((s) => s.score_1_5);
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);
    const arr = byRatee.get(r.ratee_id) ?? [];
    arr.push({ reqId: r.id, raterId: r.rater_id, avg });
    byRatee.set(r.ratee_id, arr);
  }

  const pendingComments = (reviews ?? []).filter(
    (r) => r.comment && r.comment_moderation === "pending"
  );
  const unmaskedRatees = new Set((unmasks ?? []).map((u) => u.ratee_id));

  const submitted = reqs.filter((r) => r.status === "submitted").length;

  return (
    <div className="space-y-4">
      <Link href="/admin/peer" className="text-sm text-neutral-400 hover:text-emerald-600">
        ← Siklus
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {cycle.name} <span className="chip bg-neutral-100 text-neutral-500">{cycle.status}</span>
        </h1>
        <div className="flex gap-2">
          {cycle.status === "draft" && (
            <form action={openCycleAction}>
              <input type="hidden" name="cycle_id" value={id} />
              <button className="btn-primary text-xs">Buka siklus (kirim push ke penilai)</button>
            </form>
          )}
          {cycle.status === "open" && (
            <form action={closeCycleAction}>
              <input type="hidden" name="cycle_id" value={id} />
              <button className="btn-secondary text-xs">Tutup jendela</button>
            </form>
          )}
          {cycle.status === "closed" && (
            <form action={publishCycleAction}>
              <input type="hidden" name="cycle_id" value={id} />
              <button
                className="btn-primary text-xs"
                title={pendingComments.length ? "Masih ada komentar belum dimoderasi" : ""}
              >
                Publikasikan hasil
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="-mt-3 text-sm text-neutral-500">
        Progress: {submitted}/{reqs.length} penilaian masuk.
      </p>

      {/* Moderation queue */}
      {pendingComments.length > 0 && (
        <div className="card space-y-3 border-amber-200">
          <h2 className="font-semibold">🛡️ Moderasi komentar ({pendingComments.length})</h2>
          <p className="text-xs text-neutral-400">
            Nama penilai tidak ditampilkan. Approve = diteruskan apa adanya; Redact = kamu tulis ulang
            tanpa detail yang mengidentifikasi; Hide = tidak diteruskan sama sekali.
          </p>
          {pendingComments.map((r) => {
            const req = reqs.find((q) => q.id === r.request_id);
            return (
              <div key={r.id} className="rounded-lg bg-neutral-50 p-3 text-sm">
                <p className="mb-1 text-xs text-neutral-400">
                  Untuk: <b>{nameOf.get(req?.ratee_id ?? "") ?? "?"}</b> (penilai disembunyikan)
                </p>
                <p className="mb-2">“{r.comment}”</p>
                <div className="flex flex-wrap gap-2">
                  <form action={moderateCommentAction}>
                    <input type="hidden" name="review_id" value={r.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className="btn-primary !py-1 text-xs">Approve</button>
                  </form>
                  <form action={moderateCommentAction} className="flex gap-1">
                    <input type="hidden" name="review_id" value={r.id} />
                    <input type="hidden" name="decision" value="redacted" />
                    <input
                      name="redacted_comment"
                      placeholder="tulis ulang tanpa identitas…"
                      className="input !w-64 !py-1 text-xs"
                      required
                    />
                    <button className="btn-secondary !py-1 text-xs">Redact</button>
                  </form>
                  <form action={moderateCommentAction}>
                    <input type="hidden" name="review_id" value={r.id} />
                    <input type="hidden" name="decision" value="hidden" />
                    <button className="btn-danger !py-1 text-xs">Hide</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aggregates with anonymity floor + outlier flags */}
      <div className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Hasil (agregat)</h2>
        <table className="data min-w-[560px]">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Penilai masuk</th>
              {categories.map((c) => (
                <th key={c.category_key}>{c.label.split(" ")[0]}</th>
              ))}
              <th>Rata²</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {[...new Set(reqs.map((r) => r.ratee_id))].map((rateeId) => {
              const submissions = byRatee.get(rateeId) ?? [];
              const sufficient = submissions.length >= 3;
              // per category averages
              const catAvgs = categories.map((c) => {
                const vals = submissions
                  .map((s) => {
                    const review = reviewByReq.get(s.reqId);
                    return (review?.scores as { category_key: string; score_1_5: number }[])?.find(
                      (x) => x.category_key === c.category_key
                    )?.score_1_5;
                  })
                  .filter((v): v is number => typeof v === "number");
                return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
              });
              const overall = submissions.length
                ? Math.round((submissions.reduce((a, s) => a + s.avg, 0) / submissions.length) * 100) / 100
                : null;
              // outlier: a rater deviating > 2 points from the mean of the other raters
              const outliers = submissions.filter((s) => {
                const others = submissions.filter((o) => o !== s);
                if (!others.length) return false;
                const mean = others.reduce((a, o) => a + o.avg, 0) / others.length;
                return Math.abs(s.avg - mean) > 2;
              });
              return (
                <tr key={rateeId}>
                  <td className="font-medium">{nameOf.get(rateeId) ?? "?"}</td>
                  <td>{submissions.length}</td>
                  {sufficient ? (
                    catAvgs.map((v, i) => <td key={i}>{v ?? "—"}</td>)
                  ) : (
                    <td colSpan={categories.length} className="text-neutral-400">
                      insufficient raters (&lt; 3) — tidak ditampilkan
                    </td>
                  )}
                  <td className="font-semibold">{sufficient ? overall : "—"}</td>
                  <td>
                    {outliers.length > 0 && (
                      <span
                        className="chip bg-amber-100 text-amber-700"
                        title="Ada penilai yang menyimpang >2 poin dari penilai lain (kemungkinan grudge/halo) — ditandai, tidak dibuang otomatis"
                      >
                        outlier
                      </span>
                    )}
                    {isOwner && unmaskedRatees.has(rateeId) && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-red-600">
                          🔓 identitas penilai (unmasked)
                        </summary>
                        <ul className="text-xs text-neutral-500">
                          {submissions.map((s) => (
                            <li key={s.reqId}>
                              {nameOf.get(s.raterId)} → {s.avg.toFixed(1)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isOwner && (
          <form action={unmaskAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
            <input type="hidden" name="cycle_id" value={id} />
            <div>
              <label className="label">🔓 Unmask penilai (owner only — tercatat di audit log)</label>
              <select name="ratee_id" className="input !w-auto" required>
                <option value="">— pilih karyawan —</option>
                {[...new Set(reqs.map((r) => r.ratee_id))].map((rid) => (
                  <option key={rid} value={rid}>
                    {nameOf.get(rid)}
                  </option>
                ))}
              </select>
            </div>
            <input name="reason" placeholder="Alasan (wajib — investigasi abuse)" className="input !w-64" required />
            <button className="btn-danger text-xs">Unmask</button>
          </form>
        )}
      </div>

      {/* Rater assignments */}
      <div className="card space-y-2">
        <h2 className="font-semibold">Penugasan penilai</h2>
        {cycle.status === "draft" && (
          <form action={addRequestAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="cycle_id" value={id} />
            <select name="rater_id" className="input !w-auto" required>
              <option value="">penilai…</option>
              {(profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <span className="self-center text-sm">menilai</span>
            <select name="ratee_id" className="input !w-auto" required>
              <option value="">dinilai…</option>
              {(profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <button className="btn-secondary text-xs">+ Tambah</button>
          </form>
        )}
        <table className="data">
          <thead>
            <tr>
              <th>Penilai</th>
              <th>Menilai</th>
              <th>Status</th>
              {cycle.status === "draft" && <th></th>}
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id}>
                <td>{nameOf.get(r.rater_id)}</td>
                <td>{nameOf.get(r.ratee_id)}</td>
                <td>{r.status}</td>
                {cycle.status === "draft" && (
                  <td>
                    <form action={removeRequestAction}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="cycle_id" value={id} />
                      <button className="text-xs text-red-500">hapus</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
