-- TeamOS combined setup — paste into the Supabase SQL editor in one go.
-- Generated from supabase/migrations/001..003.

-- TeamOS schema (PRD v1.2/1.4 §3)
-- All timestamps UTC; day boundaries computed in Asia/Jakarta at the app layer.

create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────
create type permission_level as enum ('owner','manager','employee');
create type work_type as enum ('fulltime','intern_paid','intern_unpaid','freelance');
create type employment_status as enum ('not_started','active','probation','resigned','terminated');
create type leave_type as enum ('annual','sick','unpaid','special','izin_late','izin_early','half_day');
create type request_status as enum ('pending','approved','rejected','cancelled');
create type kpi_assignment_status as enum ('active','revoked','completed');
create type kpi_entry_status as enum ('draft','shared_with_employee');
create type contract_kind as enum ('pkwt','pkwtt','intern_paid','intern_unpaid');
create type contract_status as enum ('draft','issued','signed');
create type task_status as enum ('pending','done');
create type peer_cycle_status as enum ('draft','open','closed','published');
create type peer_request_status as enum ('pending','submitted','skipped');
create type comment_moderation as enum ('pending','approved','redacted','hidden');

-- ── 3.1 entities ────────────────────────────────────────────────────
create table entities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- NORA P pin (hardcoded per owner) — adjustable later in Settings
  office_lat double precision not null default -7.278475,
  office_lng double precision not null default 112.632539,
  geofence_radius_m integer not null default 200,
  work_start_time time not null default '09:00',
  work_end_time time not null default '17:00',
  late_grace_min integer not null default 15,
  working_days_per_month integer not null default 22,
  manager_recap_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.2b departments ────────────────────────────────────────────────
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.4 roles (default KPI metric libraries) ────────────────────────
create table roles (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id),
  name text not null,
  kpi_rubric jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.2 profiles ────────────────────────────────────────────────────
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text unique not null,
  entity_id uuid references entities(id),           -- NULL = works across both entities ("Both")
  department_id uuid references departments(id),
  role_id uuid references roles(id),
  full_name text not null,
  phone text,
  permission permission_level not null default 'employee',
  work_type work_type not null default 'fulltime',
  intern_start date,
  intern_end date,
  start_date date,
  employment_status employment_status not null default 'active',
  badge text,
  notes text,
  leave_balance_annual numeric not null default 12,
  leave_balance_carryover numeric not null default 0,
  manager_id uuid references profiles(id),
  push_muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.3 bank_accounts (mandatory, one active per employee) ──────────
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  bank_name text not null,
  account_number text not null,
  account_holder_name text not null,
  entered_by uuid references profiles(id),
  confirmed_by_employee boolean not null default false,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bank_accounts_profile_idx on bank_accounts(profile_id) where is_active;

-- ── wages (owner-only; estimation input, never payroll math) ────────
create table wages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  monthly_wage numeric not null,
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

-- ── 3.5 contracts ───────────────────────────────────────────────────
create table contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind contract_kind not null,
  body_md text not null,
  merge_fields jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  template_id uuid references contract_templates(id),
  kind contract_kind not null,
  start_date date,
  end_date date,
  body_md text not null,
  status contract_status not null default 'draft',
  issued_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.6 onboarding ──────────────────────────────────────────────────
create table onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tasks jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  title text not null,
  assignee text not null default 'employee',
  status task_status not null default 'pending',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 3.7 leave_requests (incl. izin) ─────────────────────────────────
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  type leave_type not null,
  start_date date not null,
  end_date date not null,
  days numeric not null default 1,          -- 0 for izin_late/izin_early, 0.5 for half_day
  izin_time time,                            -- expected arrival / departure
  reason text,
  status request_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leave_requests_profile_idx on leave_requests(profile_id, start_date);

-- ── 3.8 attendance_records ──────────────────────────────────────────
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  work_date date not null,                   -- WIB calendar day
  clock_in_at timestamptz,
  clock_in_lat double precision,
  clock_in_lng double precision,
  clock_in_distance_m numeric,
  selfie_in_path text,
  clock_out_at timestamptz,
  clock_out_lat double precision,
  clock_out_lng double precision,
  clock_out_distance_m numeric,
  selfie_out_path text,
  spoof_score integer not null default 0,
  spoof_signals jsonb not null default '[]',
  late boolean not null default false,
  late_suppressed_by uuid references leave_requests(id),  -- approved izin_late
  missing_clock_out boolean not null default false,
  flags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, work_date)
);

-- ── 3.9 attendance_rejected_attempts ────────────────────────────────
create table attendance_rejected_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  attempted_at timestamptz not null default now(),
  kind text not null check (kind in ('in','out')),
  lat double precision,
  lng double precision,
  distance_m numeric,
  reason text not null,
  spoof_score integer not null default 0,
  spoof_signals jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ── 3.10 kpi_assignments (the "KPI box") ────────────────────────────
create table kpi_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  assigned_by uuid not null references profiles(id),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null,                    -- immutable snapshot at send time
  status kpi_assignment_status not null default 'active',
  revoked_at timestamptz,
  revoked_by uuid references profiles(id),
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutability: metrics snapshot never mutates after send; rows are never deleted.
create or replace function kpi_assignment_guard() returns trigger
language plpgsql as $$
begin
  if new.metrics is distinct from old.metrics then
    raise exception 'kpi_assignments.metrics is immutable — revoke and send a new assignment';
  end if;
  return new;
end $$;
create trigger kpi_assignments_immutable before update on kpi_assignments
  for each row execute function kpi_assignment_guard();

-- ── 3.11 kpi_entries ────────────────────────────────────────────────
create table kpi_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references kpi_assignments(id),
  scores jsonb not null default '[]',        -- [{metric_key, score_0_100, note}]
  overall_note text,
  entered_by uuid not null references profiles(id),
  status kpi_entry_status not null default 'draft',
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Acceptance #15: no delete path exists — deny DELETE at the grant level.
revoke delete on kpi_assignments from authenticated, anon;
revoke delete on kpi_entries from authenticated, anon;
revoke delete on bank_accounts from authenticated, anon;   -- never hard-delete bank rows

-- ── 3.12 ai_suggestions_log ─────────────────────────────────────────
create table ai_suggestions_log (
  id uuid primary key default gen_random_uuid(),
  context jsonb not null,
  suggestions jsonb not null,
  accepted jsonb,
  requested_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ── 3.13 push_subscriptions ─────────────────────────────────────────
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  endpoint text not null unique,
  keys jsonb not null,
  platform text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.14 peer_review_cycles ─────────────────────────────────────────
create table peer_review_cycles (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id),    -- NULL = both entities
  name text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status peer_cycle_status not null default 'draft',
  categories jsonb not null,                 -- snapshot at open (§4.8)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3.15 peer_review_requests ───────────────────────────────────────
create table peer_review_requests (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references peer_review_cycles(id),
  rater_id uuid not null references profiles(id),
  ratee_id uuid not null references profiles(id),
  status peer_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);

-- ── 3.16 peer_reviews ───────────────────────────────────────────────
create table peer_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references peer_review_requests(id),
  scores jsonb not null,                     -- [{category_key, score_1_5}]
  comment text,
  redacted_comment text,                     -- what the ratee sees when moderation = redacted
  comment_moderation comment_moderation not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Owner-only unmask escape hatch — deliberately loud.
create table unmask_log (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references peer_review_cycles(id),
  ratee_id uuid not null references profiles(id),
  requested_by uuid not null references profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ── 3.17 monthly_reports ────────────────────────────────────────────
create table monthly_reports (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id),    -- NULL = combined
  period_month date not null,                -- first day of the month
  version integer not null default 1,
  content_md text not null,
  data_snapshot jsonb not null,
  model text not null,
  generated_at timestamptz not null default now(),
  read_by jsonb not null default '[]'
);

-- Reports are immutable once generated; regeneration inserts a new version row.
create or replace function monthly_report_guard() returns trigger
language plpgsql as $$
begin
  if new.content_md is distinct from old.content_md
     or new.data_snapshot is distinct from old.data_snapshot then
    raise exception 'monthly_reports are immutable — regenerate to create a new version';
  end if;
  return new;
end $$;
create trigger monthly_reports_immutable before update on monthly_reports
  for each row execute function monthly_report_guard();

-- ── audit: wage receipt exports (§4.6) ──────────────────────────────
create table wage_export_log (
  id uuid primary key default gen_random_uuid(),
  exported_by uuid not null references profiles(id),
  profile_id uuid not null references profiles(id),
  period_month date not null,
  masked boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── wa send log (§4.11 — failures logged + retried once) ───────────
create table wa_send_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                        -- 'daily_recap' | 'receipt' | ...
  recipient text not null,
  ok boolean not null,
  error text,
  attempt integer not null default 1,
  created_at timestamptz not null default now()
);

-- ── updated_at maintenance ──────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'entities','departments','roles','profiles','bank_accounts','contracts',
    'leave_requests','attendance_records','kpi_assignments','kpi_entries',
    'push_subscriptions','peer_review_cycles','peer_review_requests',
    'peer_reviews'
  ] loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ── auth linkage: placeholder-email profiles claim their auth user ──
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set user_id = new.id
  where email = lower(new.email) and user_id is null;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── atomic leave approval (sick never touches annual; izin never decrements) ──
create or replace function public.approve_leave(p_request uuid, p_reviewer uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r leave_requests%rowtype;
  deduct numeric := 0;
begin
  select * into r from leave_requests where id = p_request for update;
  if not found then raise exception 'leave request not found'; end if;
  if r.status <> 'pending' then raise exception 'request already reviewed'; end if;

  if r.type = 'annual' then deduct := r.days;
  elsif r.type = 'half_day' then deduct := 0.5;
  end if;

  if deduct > 0 then
    update profiles
      set leave_balance_annual = leave_balance_annual - deduct
      where id = r.profile_id and (leave_balance_annual + leave_balance_carryover) >= deduct;
    if not found then raise exception 'insufficient annual leave balance'; end if;
  end if;

  update leave_requests
    set status = 'approved', reviewed_by = p_reviewer, reviewed_at = now(), review_note = p_note
    where id = p_request;

  -- Approved izin_late suppresses the late flag on that day's record (if it exists already);
  -- clock-in also checks approved izin so ordering doesn't matter.
  if r.type = 'izin_late' then
    update attendance_records set late = false, late_suppressed_by = r.id
      where profile_id = r.profile_id and work_date = r.start_date;
  elsif r.type = 'izin_early' then
    update attendance_records set missing_clock_out = false
      where profile_id = r.profile_id and work_date = r.start_date;
  end if;
end $$;

-- ── storage: private selfies bucket (≤300KB enforced app-side; 90-day cleanup via cron) ──
insert into storage.buckets (id, name, public)
values ('selfies','selfies', false)
on conflict (id) do nothing;

-- TeamOS row-level security (PRD §3.14)
-- Employee: own rows. Manager: team + moderation surfaces. Owner: everything incl. wages.

-- ── helpers (security definer to avoid RLS recursion on profiles) ───
create or replace function public.current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid()
$$;

create or replace function public.my_permission() returns text
language sql stable security definer set search_path = public as $$
  select permission::text from profiles where user_id = auth.uid()
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_permission() = 'owner', false)
$$;

create or replace function public.is_manager_or_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_permission() in ('manager','owner'), false)
$$;

-- ── enable RLS everywhere ───────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'entities','departments','roles','profiles','bank_accounts','wages',
    'contract_templates','contracts','onboarding_templates','onboarding_tasks',
    'leave_requests','attendance_records','attendance_rejected_attempts',
    'kpi_assignments','kpi_entries','ai_suggestions_log','push_subscriptions',
    'peer_review_cycles','peer_review_requests','peer_reviews','unmask_log',
    'monthly_reports','wage_export_log','wa_send_log'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ── entities / departments / roles: directory-level reads, owner writes ──
create policy entities_read on entities for select to authenticated using (true);
create policy entities_write on entities for update to authenticated using (public.is_owner());

create policy departments_read on departments for select to authenticated using (true);
create policy departments_write on departments for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

create policy roles_read on roles for select to authenticated using (true);
create policy roles_write on roles for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- ── profiles: everyone reads the directory; own row + manager/owner update ──
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_own on profiles for update to authenticated
  using (user_id = auth.uid());
create policy profiles_update_mgr on profiles for update to authenticated
  using (public.is_manager_or_owner());
create policy profiles_insert_mgr on profiles for insert to authenticated
  with check (public.is_manager_or_owner());

-- ── bank_accounts: own + manager/owner (they execute transfers manually) ──
create policy bank_read on bank_accounts for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy bank_insert on bank_accounts for insert to authenticated
  with check (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy bank_update on bank_accounts for update to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());

-- ── wages: owner only, ever ─────────────────────────────────────────
create policy wages_owner on wages for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ── contracts ───────────────────────────────────────────────────────
create policy contract_templates_read on contract_templates for select to authenticated
  using (public.is_manager_or_owner());
create policy contract_templates_write on contract_templates for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
create policy contracts_read on contracts for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy contracts_write on contracts for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- ── onboarding ──────────────────────────────────────────────────────
create policy onboarding_templates_rw on onboarding_templates for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
create policy onboarding_tasks_read on onboarding_tasks for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy onboarding_tasks_update on onboarding_tasks for update to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy onboarding_tasks_insert on onboarding_tasks for insert to authenticated
  with check (public.is_manager_or_owner());

-- ── leave_requests ──────────────────────────────────────────────────
create policy leave_read on leave_requests for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy leave_insert on leave_requests for insert to authenticated
  with check (profile_id = public.current_profile_id() or public.is_manager_or_owner());
-- employees may cancel their own pending requests; managers review
create policy leave_update_own on leave_requests for update to authenticated
  using (profile_id = public.current_profile_id() and status = 'pending');
create policy leave_update_mgr on leave_requests for update to authenticated
  using (public.is_manager_or_owner());

-- ── attendance (writes go through server actions; reads scoped) ─────
create policy attendance_read on attendance_records for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_manager_or_owner());
create policy rejected_read on attendance_rejected_attempts for select to authenticated
  using (public.is_manager_or_owner());

-- ── KPI: employee sees a box ONLY while a non-revoked assignment exists ──
create policy kpi_assignments_read_own on kpi_assignments for select to authenticated
  using (profile_id = public.current_profile_id() and status <> 'revoked');
create policy kpi_assignments_read_mgr on kpi_assignments for select to authenticated
  using (public.is_manager_or_owner());
create policy kpi_assignments_insert on kpi_assignments for insert to authenticated
  with check (public.is_manager_or_owner());
create policy kpi_assignments_update on kpi_assignments for update to authenticated
  using (public.is_manager_or_owner());
-- no delete policy + revoked DELETE grant = revoked history is permanent

create policy kpi_entries_read_own on kpi_entries for select to authenticated
  using (
    status = 'shared_with_employee'
    and exists (
      select 1 from kpi_assignments a
      where a.id = assignment_id
        and a.profile_id = public.current_profile_id()
        and a.status <> 'revoked'
    )
  );
create policy kpi_entries_read_mgr on kpi_entries for select to authenticated
  using (public.is_manager_or_owner());
create policy kpi_entries_write on kpi_entries for insert to authenticated
  with check (public.is_manager_or_owner());
create policy kpi_entries_update on kpi_entries for update to authenticated
  using (public.is_manager_or_owner());

-- ── AI suggestions audit ────────────────────────────────────────────
create policy ai_log_rw on ai_suggestions_log for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- ── push subscriptions: own devices only ────────────────────────────
create policy push_own on push_subscriptions for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- ── peer assessment ─────────────────────────────────────────────────
create policy peer_cycles_read on peer_review_cycles for select to authenticated using (true);
create policy peer_cycles_write on peer_review_cycles for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- A ratee must never see who rates them: requests are visible only to the
-- rater themself and to managers/owners. Ratees get aggregates via the server
-- (service role) with the ≥3-rater floor applied.
create policy peer_requests_read on peer_review_requests for select to authenticated
  using (rater_id = public.current_profile_id() or public.is_manager_or_owner());
create policy peer_requests_write on peer_review_requests for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
create policy peer_requests_submit on peer_review_requests for update to authenticated
  using (rater_id = public.current_profile_id());

-- Raw reviews: rater may insert for their own request; managers/owners read/moderate.
-- Ratees never read raw rows through any policy.
create policy peer_reviews_insert on peer_reviews for insert to authenticated
  with check (exists (
    select 1 from peer_review_requests q
    where q.id = request_id and q.rater_id = public.current_profile_id()
  ));
create policy peer_reviews_read_mgr on peer_reviews for select to authenticated
  using (public.is_manager_or_owner());
create policy peer_reviews_moderate on peer_reviews for update to authenticated
  using (public.is_manager_or_owner());

create policy unmask_owner on unmask_log for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ── monthly reports: owner/manager only; employees get 403 ─────────
create policy reports_read on monthly_reports for select to authenticated
  using (public.is_manager_or_owner());
create policy reports_update_readby on monthly_reports for update to authenticated
  using (public.is_manager_or_owner());

-- ── audit logs ──────────────────────────────────────────────────────
create policy wage_export_owner on wage_export_log for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy wa_log_read on wa_send_log for select to authenticated
  using (public.is_manager_or_owner());

-- ── storage: selfies are written by the server (service role); managers read flagged ──
create policy selfies_mgr_read on storage.objects for select to authenticated
  using (bucket_id = 'selfies' and public.is_manager_or_owner());

-- TeamOS Phase 0 seed — Appendix A roster (July 2026), 26 people + owner.
-- Placeholder emails {firstname}@teamos.local; owner uses his real email.

-- ── entities ────────────────────────────────────────────────────────
insert into entities (name) values ('NoraPadel'), ('Gridline Digital');

-- ── departments ─────────────────────────────────────────────────────
insert into departments (name, note) values
  ('Finance & Accounting', null),
  ('Development', null),
  ('Business Development', 'Michael + Vina and Jovan + Fara are linked pairs (store in each profile''s notes)'),
  ('Field Review & Video Team', 'One team — travels to all padel stores & shops to film videos and reviews.'),
  ('Content & Creative', null),
  ('Marketing, PR & SEO', null),
  ('E-commerce Operations', null);

-- ── roles: default KPI metric libraries (§5, owner-editable pick-lists) ──
insert into roles (name, kpi_rubric) values
('Admin', '[
  {"metric_key":"order_accuracy","label":"Akurasi order","description":"Order diproses tanpa kesalahan","default_target":98,"unit":"%"},
  {"metric_key":"response_time","label":"Kecepatan respon","description":"Rata-rata waktu respon chat/order","default_target":15,"unit":"menit"},
  {"metric_key":"packing_sla","label":"SLA packing","description":"Order dikemas & dikirim H+0/H+1","default_target":95,"unit":"%"},
  {"metric_key":"data_hygiene","label":"Kerapian data","description":"Stok & catatan order selalu update","default_target":100,"unit":"%"}
]'),
('Accounting', '[
  {"metric_key":"recon_timeliness","label":"Rekonsiliasi tepat waktu","description":"Rekonsiliasi bank/kas selesai sesuai jadwal","default_target":100,"unit":"%"},
  {"metric_key":"error_rate","label":"Tingkat kesalahan","description":"Kesalahan pencatatan per bulan","default_target":0,"unit":"kasus"},
  {"metric_key":"report_punctuality","label":"Laporan tepat waktu","description":"Laporan bulanan selesai sebelum tanggal 5","default_target":100,"unit":"%"}
]'),
('Purchasing', '[
  {"metric_key":"cost_saving","label":"Penghematan biaya","description":"Penghematan dibanding harga list","default_target":5,"unit":"%"},
  {"metric_key":"po_lead_time","label":"Lead time PO","description":"Rata-rata hari dari PO ke barang datang","default_target":7,"unit":"hari"},
  {"metric_key":"stockout","label":"Kejadian stockout","description":"SKU utama kehabisan stok","default_target":0,"unit":"kasus"}
]'),
('Content', '[
  {"metric_key":"posts_shipped","label":"Konten terbit","description":"Jumlah konten publish per bulan","default_target":20,"unit":"post"},
  {"metric_key":"engagement_rate","label":"Engagement rate","description":"Rata-rata ER konten bulan ini","default_target":4,"unit":"%"},
  {"metric_key":"revision_rounds","label":"Ronde revisi","description":"Rata-rata revisi per konten","default_target":1,"unit":"ronde"}
]'),
('Video Editing', '[
  {"metric_key":"videos_delivered","label":"Video selesai","description":"Video final terkirim per bulan","default_target":12,"unit":"video"},
  {"metric_key":"turnaround","label":"Turnaround","description":"Rata-rata hari dari footage ke final","default_target":3,"unit":"hari"},
  {"metric_key":"revision_rounds","label":"Ronde revisi","description":"Rata-rata revisi per video","default_target":1,"unit":"ronde"}
]'),
('PR (IG engagement)', '[
  {"metric_key":"follower_growth","label":"Pertumbuhan follower","description":"Follower baru bulan ini","default_target":1000,"unit":"follower"},
  {"metric_key":"engagement_rate","label":"Engagement rate","description":"ER akun bulan ini","default_target":5,"unit":"%"},
  {"metric_key":"collabs","label":"Kolaborasi","description":"Kolaborasi/mention berjalan","default_target":4,"unit":"kolab"}
]'),
('Sales (titip jual)', '[
  {"metric_key":"new_locations","label":"Lokasi baru","description":"Titik titip jual/konsinyasi baru","default_target":4,"unit":"lokasi"},
  {"metric_key":"sell_through","label":"Sell-through","description":"Persentase stok titipan terjual","default_target":60,"unit":"%"},
  {"metric_key":"reseller_revenue","label":"Omzet reseller","description":"Omzet channel reseller (juta Rp)","default_target":30,"unit":"jt"}
]'),
('Event Maker', '[
  {"metric_key":"events_executed","label":"Event terlaksana","description":"Event/kolaborasi muse selesai","default_target":2,"unit":"event"},
  {"metric_key":"muse_pipeline","label":"Pipeline muse","description":"Kandidat muse aktif dalam pipeline","default_target":6,"unit":"orang"},
  {"metric_key":"budget_adherence","label":"Kepatuhan budget","description":"Realisasi vs budget event","default_target":100,"unit":"%"}
]'),
('Developer', '[
  {"metric_key":"delivery","label":"Delivery","description":"Fitur/tiket selesai sesuai sprint","default_target":90,"unit":"%"},
  {"metric_key":"bug_rate","label":"Bug rate","description":"Bug produksi dari rilis bulan ini","default_target":2,"unit":"bug"},
  {"metric_key":"review_turnaround","label":"Review turnaround","description":"Rata-rata jam merespon code review","default_target":24,"unit":"jam"}
]'),
('SEO', '[
  {"metric_key":"rankings_delta","label":"Kenaikan ranking","description":"Keyword utama naik posisi","default_target":10,"unit":"keyword"},
  {"metric_key":"pages_shipped","label":"Halaman terbit","description":"Halaman/artikel SEO publish","default_target":8,"unit":"halaman"},
  {"metric_key":"backlinks","label":"Backlink","description":"Backlink baru berkualitas","default_target":5,"unit":"link"}
]');

-- ── profiles ────────────────────────────────────────────────────────
-- Entity "Both" ⇒ entity_id NULL. TBD intern types default intern_unpaid
-- (excluded from wage math). Roles marked TBD get no role_id.
do $$
declare
  nora uuid; grid uuid;
  d_fin uuid; d_dev uuid; d_biz uuid; d_frv uuid; d_cnt uuid; d_mkt uuid; d_eco uuid;
  r_admin uuid; r_acct uuid; r_purch uuid; r_content uuid; r_video uuid;
  r_pr uuid; r_sales uuid; r_event uuid; r_devl uuid; r_seo uuid;
  p_zabilla uuid; p_reva uuid;
begin
  select id into nora from entities where name = 'NoraPadel';
  select id into grid from entities where name = 'Gridline Digital';
  select id into d_fin from departments where name = 'Finance & Accounting';
  select id into d_dev from departments where name = 'Development';
  select id into d_biz from departments where name = 'Business Development';
  select id into d_frv from departments where name = 'Field Review & Video Team';
  select id into d_cnt from departments where name = 'Content & Creative';
  select id into d_mkt from departments where name = 'Marketing, PR & SEO';
  select id into d_eco from departments where name = 'E-commerce Operations';
  select id into r_admin from roles where name = 'Admin';
  select id into r_acct from roles where name = 'Accounting';
  select id into r_purch from roles where name = 'Purchasing';
  select id into r_content from roles where name = 'Content';
  select id into r_video from roles where name = 'Video Editing';
  select id into r_pr from roles where name = 'PR (IG engagement)';
  select id into r_sales from roles where name = 'Sales (titip jual)';
  select id into r_event from roles where name = 'Event Maker';
  select id into r_devl from roles where name = 'Developer';
  select id into r_seo from roles where name = 'SEO';

  -- Owner
  insert into profiles (email, full_name, entity_id, department_id, permission, badge, employment_status, notes)
  values ('cliveibrahim8@gmail.com', 'Clive Ibrahim', null, null, 'owner', 'Founder & CEO', 'active',
          'Founder & CEO — NoraPadel + Gridline Digital');

  insert into profiles (email, full_name, entity_id, department_id, role_id, badge, work_type, employment_status, intern_start, intern_end, notes) values
  ('zabilla@teamos.local',  'Zabilla',          null, d_fin, r_purch,  'Lead',     'fulltime',      'active',      null, null, 'Inventory, purchasing & accounting lead'),
  ('khofifah@teamos.local', 'Khofifah',         null, d_fin, r_acct,   null,       'fulltime',      'active',      null, null, 'Accounting'),
  ('muafi@teamos.local',    'Muafi',            null, d_dev, r_devl,   'Lead Dev', 'fulltime',      'active',      null, null, 'Leads the development team'),
  ('faul@teamos.local',     'Faul',             null, d_dev, r_devl,   null,       'fulltime',      'active',      null, null, 'Dev for NoraPadel & Gridline; sells SMMA & AI to international clients'),
  ('joe@teamos.local',      'Joe',              null, d_dev, r_devl,   'Intern',   'intern_unpaid', 'active',      null, null, 'Developer intern — period TBD (owner to correct in Settings)'),
  ('melissa@teamos.local',  'Melissa',          null, d_dev, r_devl,   'Intern',   'intern_unpaid', 'active',      null, null, 'Developer intern — period TBD (owner to correct in Settings)'),
  ('mohamad@teamos.local',  'Mohamad David',    null, d_dev, r_devl,   'Intern',   'intern_unpaid', 'not_started', '2026-07-20', '2027-01-31', 'Developer intern — Universitas Brawijaya'),
  ('jovan@teamos.local',    'Jovan',            nora, d_biz, r_sales,  null,       'fulltime',      'not_started', null, null, 'Secures locations for product placement; consignment & reseller deals. Linked pair with Fara — travels with Fara for biz-dev'),
  ('fara@teamos.local',     'Fara',             nora, d_biz, r_sales,  null,       'fulltime',      'active',      null, null, 'Assistant to Jovan — travels together for field & biz-dev'),
  ('michael@teamos.local',  'Michael Lawrence', nora, d_biz, r_sales,  null,       'fulltime',      'not_started', null, null, 'Location placement, consignment & reseller. Linked pair with Vina — travels with Vina for biz-dev'),
  ('vina@teamos.local',     'Vina',             nora, d_biz, r_sales,  null,       'fulltime',      'active',      null, null, 'Assistant to Michael Lawrence — travels together for field & biz-dev'),
  ('aisyah@teamos.local',   'Aisyah',           nora, d_frv, r_video,  null,       'fulltime',      'not_started', null, null, 'Store reviews & video'),
  ('cikal@teamos.local',    'Cikal',            nora, d_frv, r_video,  null,       'fulltime',      'not_started', null, null, 'Store reviews & video'),
  ('lovely@teamos.local',   'Lovely',           nora, d_frv, r_video,  null,       'fulltime',      'not_started', null, null, 'Store reviews & video'),
  ('suhaima@teamos.local',  'Suhaima',          nora, d_frv, r_video,  null,       'fulltime',      'active',      null, null, 'Store reviews & video'),
  ('windi@teamos.local',    'Windi',            nora, d_cnt, r_content,null,       'fulltime',      'active',      null, null, 'Live host 09–13, content creation 13–16'),
  ('refany@teamos.local',   'Refany',           nora, d_cnt, r_content,null,       'fulltime',      'not_started', null, null, 'Influencer content creation'),
  ('nadilah@teamos.local',  'Nadilah',          nora, d_cnt, r_content,'Junior',   'fulltime',      'active',      null, null, 'Junior content creation'),
  ('meita@teamos.local',    'Meita',            null, d_cnt, r_content,null,       'fulltime',      'active',      null, null, 'Graphic design'),
  ('anggita@teamos.local',  'Anggita',          nora, d_mkt, r_pr,     null,       'fulltime',      'active',      null, null, 'PR & social media'),
  ('ivana@teamos.local',    'Ivana',            nora, d_mkt, r_event,  null,       'fulltime',      'active',      null, null, 'Muse collaboration project — collab with Anggita'),
  ('diana@teamos.local',    'Diana',            grid, d_mkt, r_pr,     null,       'fulltime',      'not_started', null, null, 'PR for Gridline — sells SMMA to international clients'),
  ('luqman@teamos.local',   'Luqman',           null, d_mkt, r_seo,    null,       'fulltime',      'active',      null, null, 'SEO'),
  ('andrea@teamos.local',   'Andrea',           nora, d_mkt, null,     null,       'fulltime',      'not_started', null, null, 'Role TBD'),
  ('theodora@teamos.local', 'Theodora',         nora, d_mkt, null,     null,       'fulltime',      'not_started', null, null, 'Role TBD'),
  ('reva@teamos.local',     'Reva',             nora, d_eco, r_admin,  null,       'fulltime',      'active',      null, null, 'E-commerce admin & order packing');

  -- Known wages (acceptance #32). Everyone else: no wage row yet →
  -- appears in the Admin Dashboard "missing wage" filter.
  select id into p_zabilla from profiles where email = 'zabilla@teamos.local';
  select id into p_reva from profiles where email = 'reva@teamos.local';
  insert into wages (profile_id, monthly_wage, effective_from) values
    (p_zabilla, 1700000, '2026-07-01'),
    (p_reva,    1700000, '2026-07-01');

  -- Onboarding: bank-details task for every active employee (no bank data exists yet — all start ❌).
  insert into onboarding_tasks (profile_id, title, assignee)
  select id, 'Isi data rekening bank', 'employee'
  from profiles where employment_status = 'active' and permission <> 'owner';
end $$;

-- ── contract templates (placeholder legal text) ─────────────────────
insert into contract_templates (name, kind, body_md, merge_fields) values
('PKWT — Perjanjian Kerja Waktu Tertentu', 'pkwt',
 E'# PERJANJIAN KERJA WAKTU TERTENTU (PKWT)\n\n> **REVIEW WITH LEGAL COUNSEL** — placeholder sesuai UU Cipta Kerja.\n\nAntara **{{company_name}}** dan **{{employee_name}}** ({{role_name}}), periode {{start_date}} s/d {{end_date}}, gaji {{wage}}.\n\n1. Ruang lingkup pekerjaan …\n2. Jam kerja {{work_hours}} …\n3. Kerahasiaan …',
 '["company_name","employee_name","role_name","start_date","end_date","wage","work_hours"]'),
('PKWTT — Perjanjian Kerja Waktu Tidak Tertentu', 'pkwtt',
 E'# PERJANJIAN KERJA WAKTU TIDAK TERTENTU (PKWTT)\n\n> **REVIEW WITH LEGAL COUNSEL** — placeholder sesuai UU Cipta Kerja.\n\nAntara **{{company_name}}** dan **{{employee_name}}** ({{role_name}}), mulai {{start_date}}, gaji {{wage}}.',
 '["company_name","employee_name","role_name","start_date","wage"]'),
('Perjanjian Magang — Paid', 'intern_paid',
 E'# PERJANJIAN MAGANG (PAID)\n\n> **REVIEW WITH LEGAL COUNSEL** — magang punya aturan tersendiri (uang saku/benefit).\n\nAntara **{{company_name}}** dan **{{employee_name}}**, periode magang **{{intern_start}} s/d {{intern_end}}**, uang saku {{stipend}}.',
 '["company_name","employee_name","intern_start","intern_end","stipend"]'),
('Perjanjian Magang — Unpaid', 'intern_unpaid',
 E'# PERJANJIAN MAGANG (UNPAID)\n\n> **REVIEW WITH LEGAL COUNSEL** — magang punya aturan tersendiri (uang saku/benefit).\n\nAntara **{{company_name}}** dan **{{employee_name}}**, periode magang **{{intern_start}} s/d {{intern_end}}**.',
 '["company_name","employee_name","intern_start","intern_end"]');

-- ── onboarding template ─────────────────────────────────────────────
insert into onboarding_templates (name, tasks) values
('Standard onboarding', '[
  {"title":"Isi data rekening bank","assignee":"employee"},
  {"title":"Install TeamOS di HP (Add to Home Screen) + izinkan notifikasi","assignee":"employee"},
  {"title":"Lengkapi nomor WhatsApp di profil","assignee":"employee"},
  {"title":"Tanda tangan kontrak","assignee":"manager"},
  {"title":"Kenalan dengan tim & tour kantor","assignee":"manager"}
]');
