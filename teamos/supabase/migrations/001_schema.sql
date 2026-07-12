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
