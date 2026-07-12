# TeamOS — Internal HR-Lite (NoraPadel × Gridline Digital)

Mobile-first PWA per PRD v1.2/1.4: absensi (selfie + geofence 200 m), cuti & izin,
KPI assignment-based dengan Saran AI, wage dashboard owner + rincian gaji via
WhatsApp, peer assessment kuartalan, Laporan Bulanan AI, rekap harian WhatsApp.

**Standalone app** — lives in `teamos/`, separate from the Collab Hub at the repo
root. Deploy it as its own Vercel project with **Root Directory = `teamos`**
(target domain: `teamos.norapadel.my.id`).

## Setup

### 1. Supabase
Create a project, then run the migrations **in order** in the SQL editor
(or paste `supabase/setup.sql` in one go):

1. `supabase/migrations/001_schema.sql` — tables, enums, triggers, `approve_leave()`, selfies bucket
2. `supabase/migrations/002_rls.sql` — RLS on everything
3. `supabase/migrations/003_seed.sql` — 2 entities, 7 departments, 10 role rubrics, 26 people + owner (Appendix A), wages for Zabilla & Reva, contract/onboarding templates

Then create auth users (Authentication → Add user) with the seeded emails
(`{firstname}@teamos.local`, owner = `cliveibrahim8@gmail.com`) and a temp
password. On first sign-in the trigger links `auth.users` → `profiles` by email.
Force a password reset on first login (Supabase → require reset, or share
one-time passwords via WA).

### 2. Environment
Copy `.env.example` → `.env.local` and fill in. Notes:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: `npx web-push generate-vapid-keys`
- `AI_PROVIDER=anthropic` uses `claude-sonnet-4-6` (override with `ANTHROPIC_MODEL`); `gemini` and `off` also supported
- `WA_PROVIDER=fonnte` (simplest for Indonesian numbers) or `waba`; `off` disables recap silently
- `CRON_SECRET`: any long random string — Vercel sends it automatically as `Authorization: Bearer` on cron hits

### 3. Cron (Vercel)
`vercel.json` schedules (UTC → WIB):
| Job | UTC | WIB | What |
|---|---|---|---|
| `/api/cron/morning` | 02:00 Mon–Fri | 09:00 | "belum absen masuk" push (respects entity start time & mute) |
| `/api/cron/evening` | 10:00 + 11:00 Mon–Fri | 17:00 + 18:00 | clock-out push, retry, then `missing_clock_out` flag |
| `/api/cron/daily-recap` | 10:30 Mon–Fri | 17:30 | WhatsApp recap to owner (+ opt-in managers) + 90-day selfie cleanup |
| `/api/cron/monthly-report` | 00:00 on the 1st | 07:00 | AI report per entity + combined for last month |

Using pg_cron instead? Hit the same endpoints with `?secret=$CRON_SECRET`.

### 4. First run
```bash
cd teamos && npm install && npm run dev
```
Sign in as owner → **Admin → Settings** to review hours/radius. The NORA P pin
(-7.278475, 112.632539) is already seeded. Then activate the `not_started`
hires from the Command Dashboard when they actually start.

## PWA / push notes
Push only works when the app is **installed** (Add to Home Screen). iOS Safari
supports Web Push for installed PWAs since 16.4 — the onboarding checklist and
login screen tell employees this.

## Deliberate boundaries (from the PRD)
- **No payroll computation** — no PPh 21/BPJS/THR anywhere; the wage dashboard
  only does `wage − (approved unpaid days × daily rate)` and says so on a
  permanent banner + on every receipt.
- KPI assignments are immutable snapshots; revoke ≠ delete (DB denies DELETE).
- Peer scores never touch wage/KPI math; ratees can't see rater identities
  (RLS) — owner unmask writes an `unmask_log` row.
- Monthly report snapshot contains no selfies, bank numbers, or raw comments.
- Daily recap contains names + attendance only (it's WhatsApp — assume forwards).

## Known deltas vs PRD
- Contracts UI is read-only history for now (templates are seeded; issuing PDF
  contracts is the next phase — placeholder text says REVIEW WITH LEGAL COUNSEL).
- Per-entity `work_start_time` earlier than 09:00 WIB needs the morning cron
  moved earlier (route already gates on each entity's start time).
- Monthly report cron fires 07:00 WIB on the 1st (PRD said 06:00) — Vercel cron
  runs on UTC day boundaries; move to pg_cron for exact 06:00.
