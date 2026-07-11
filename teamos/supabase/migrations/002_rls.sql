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
