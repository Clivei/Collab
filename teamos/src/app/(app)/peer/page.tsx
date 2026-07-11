import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PeerCategory, PeerReviewCycle } from "@/lib/types";
import { submitPeerReviewAction } from "./actions";

export default async function PeerPage() {
  const { supabase, profile } = await requireProfile();

  // Forms waiting for me (rater view; RLS = own requests only)
  const { data: pending } = await supabase
    .from("peer_review_requests")
    .select("*, peer_review_cycles(id, name, status, categories, closes_at), ratee:profiles!peer_review_requests_ratee_id_fkey(full_name)")
    .eq("rater_id", profile.id)
    .eq("status", "pending");

  const openForms = (pending ?? []).filter(
    (r) => (r.peer_review_cycles as unknown as PeerReviewCycle)?.status === "open"
  );

  // My own published results — computed server-side (service role) with the
  // ≥3-rater anonymity floor; raw rows stay invisible to the ratee (RLS).
  const admin = createAdminClient();
  const { data: publishedCycles } = await admin
    .from("peer_review_cycles")
    .select("*")
    .eq("status", "published")
    .order("closes_at", { ascending: false })
    .limit(4);

  const myResults: {
    cycle: PeerReviewCycle;
    sufficient: boolean;
    averages: { label: string; avg: number }[];
    comments: string[];
  }[] = [];

  for (const cycle of (publishedCycles ?? []) as PeerReviewCycle[]) {
    const { data: reqs } = await admin
      .from("peer_review_requests")
      .select("id")
      .eq("cycle_id", cycle.id)
      .eq("ratee_id", profile.id)
      .eq("status", "submitted");
    const reqIds = (reqs ?? []).map((r) => r.id);
    if (!reqIds.length) continue;

    if (reqIds.length < 3) {
      myResults.push({ cycle, sufficient: false, averages: [], comments: [] });
      continue;
    }
    const { data: reviews } = await admin
      .from("peer_reviews")
      .select("scores, comment, redacted_comment, comment_moderation")
      .in("request_id", reqIds);

    const categories = cycle.categories as PeerCategory[];
    const averages = categories.map((c) => {
      const scores = (reviews ?? [])
        .map((r) => (r.scores as { category_key: string; score_1_5: number }[]).find((s) => s.category_key === c.category_key)?.score_1_5)
        .filter((v): v is number => typeof v === "number");
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { label: c.label, avg: Math.round(avg * 10) / 10 };
    });
    // Only moderation-approved comments reach the ratee; redactions persist.
    const comments = (reviews ?? [])
      .map((r) =>
        r.comment_moderation === "approved"
          ? r.comment
          : r.comment_moderation === "redacted"
            ? r.redacted_comment
            : null
      )
      .filter((c): c is string => !!c);
    myResults.push({ cycle, sufficient: true, averages, comments });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Peer Assessment</h1>
      <p className="-mt-3 text-xs text-neutral-500">
        Penilaianmu anonim untuk rekan yang dinilai. Komentar dimoderasi manajer — tapi nada tetap
        terasa, tulis dengan jujur & konstruktif.
      </p>

      {openForms.map((r) => {
        const cycle = r.peer_review_cycles as unknown as PeerReviewCycle;
        const ratee = r.ratee as unknown as { full_name: string };
        const categories = cycle.categories as PeerCategory[];
        return (
          <form key={r.id} action={submitPeerReviewAction} className="card space-y-3">
            <input type="hidden" name="request_id" value={r.id} />
            <h2 className="font-semibold">
              Nilai: {ratee.full_name} <span className="text-xs text-neutral-400">({cycle.name})</span>
            </h2>
            {categories.map((c) => (
              <div key={c.category_key}>
                <label className="label">
                  {c.label}
                  <span className="block font-normal text-neutral-400">{c.description}</span>
                </label>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="w-28">1 = {c.anchor_low}</span>
                  <input
                    type="range"
                    name={`score_${c.category_key}`}
                    min={1}
                    max={5}
                    step={1}
                    defaultValue={3}
                    className="flex-1"
                  />
                  <span className="w-28 text-right">5 = {c.anchor_high}</span>
                </div>
              </div>
            ))}
            <div>
              <label className="label">Komentar (opsional, dimoderasi)</label>
              <textarea name="comment" className="input" rows={2} />
            </div>
            <button className="btn-primary w-full">Kirim penilaian</button>
          </form>
        );
      })}
      {!openForms.length && (
        <div className="card text-sm text-neutral-400">Tidak ada penilaian yang menunggu kamu.</div>
      )}

      {myResults.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Hasil kamu</h2>
          {myResults.map(({ cycle, sufficient, averages, comments }) => (
            <div key={cycle.id} className="card space-y-2">
              <h3 className="text-sm font-semibold">{cycle.name}</h3>
              {!sufficient ? (
                <p className="text-sm text-neutral-400">
                  Penilai belum cukup (&lt; 3) — hasil tidak ditampilkan demi anonimitas.
                </p>
              ) : (
                <>
                  <ul className="space-y-1 text-sm">
                    {averages.map((a) => (
                      <li key={a.label} className="flex justify-between">
                        <span>{a.label}</span>
                        <b>{a.avg} / 5</b>
                      </li>
                    ))}
                  </ul>
                  {comments.length > 0 && (
                    <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                      {comments.map((c, i) => (
                        <p key={i} className="mb-1">
                          “{c}”
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
