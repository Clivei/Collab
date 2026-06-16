-- ============================================================
-- NoraPadel Collab Hub — FULL DATABASE SETUP
-- Paste this ENTIRE file into the Supabase SQL Editor and click RUN.
-- Safe to run more than once (uses "if not exists").
-- ============================================================

-- Needed for generating IDs
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------
-- 1. SUBMISSIONS  (people who fill the public application form)
-- ----------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  role text not null check (role in ('muse', 'photographer', 'stylist', 'mua')),
  wa_number text not null,
  email text,
  user_id uuid references auth.users(id),
  notes text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected', 'archived')),
  details jsonb not null default '{}',
  edit_token uuid default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- in case the table already existed without these columns:
alter table public.submissions add column if not exists email text;
alter table public.submissions add column if not exists user_id uuid references auth.users(id);

-- ----------------------------------------------------------------
-- 2. SESSIONS  (the photo shoots you plan)
-- ----------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  date date,
  location text,
  status text not null default 'idea' check (status in ('idea', 'team_forming', 'team_set', 'scheduled', 'shoot_day', 'completed')),
  notes text,
  mood_board_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 3. SESSION MEMBERS  (who is on each shoot team)
-- ----------------------------------------------------------------
create table if not exists public.session_members (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  role text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(session_id, submission_id)
);

-- ----------------------------------------------------------------
-- 4. CHATS + MESSAGES  (group chat per session)
-- ----------------------------------------------------------------
create table if not exists public.chats (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.sessions(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid references auth.users(id),
  sender_name text,
  body text,
  attachment_url text,
  created_at timestamptz not null default now()
);
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists body text;

-- ----------------------------------------------------------------
-- 5. CONCEPT BOARD  (Pinterest-style idea cards)
-- ----------------------------------------------------------------
create table if not exists public.concept_cards (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  cover_image_url text,
  cover_image_type text check (cover_image_type in ('upload', 'gdrive')),
  tags text[] default '{}',
  session_id uuid references public.sessions(id) on delete set null,
  created_by uuid references auth.users(id),
  status text not null default 'idea' check (status in ('idea', 'active', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_images (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references public.concept_cards(id) on delete cascade,
  url text not null,
  type text not null check (type in ('upload', 'gdrive')),
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.card_comments (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references public.concept_cards(id) on delete cascade,
  user_id uuid references auth.users(id),
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 6. AUTO-UPDATE "updated_at" timestamps
-- ----------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists submissions_updated_at on public.submissions;
create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.handle_updated_at();

drop trigger if exists sessions_updated_at on public.sessions;
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.handle_updated_at();

drop trigger if exists concept_cards_updated_at on public.concept_cards;
create trigger concept_cards_updated_at before update on public.concept_cards
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------
-- 7. SECURITY RULES (Row Level Security)
--    - Anyone can SUBMIT the public form
--    - Only logged-in users (admins + collaborators) can read/manage data
-- ----------------------------------------------------------------
alter table public.submissions enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.concept_cards enable row level security;
alter table public.card_images enable row level security;
alter table public.card_comments enable row level security;

-- helper: drop a policy if it already exists, then create it
-- submissions
drop policy if exists "Anyone can submit" on public.submissions;
create policy "Anyone can submit" on public.submissions for insert with check (true);
drop policy if exists "Authenticated read submissions" on public.submissions;
create policy "Authenticated read submissions" on public.submissions for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated update submissions" on public.submissions;
create policy "Authenticated update submissions" on public.submissions for update using (auth.role() = 'authenticated');

-- sessions
drop policy if exists "Authenticated manage sessions" on public.sessions;
create policy "Authenticated manage sessions" on public.sessions for all using (auth.role() = 'authenticated');

-- session_members
drop policy if exists "Authenticated manage session members" on public.session_members;
create policy "Authenticated manage session members" on public.session_members for all using (auth.role() = 'authenticated');

-- chats
drop policy if exists "Authenticated manage chats" on public.chats;
create policy "Authenticated manage chats" on public.chats for all using (auth.role() = 'authenticated');

-- messages
drop policy if exists "Authenticated read messages" on public.messages;
create policy "Authenticated read messages" on public.messages for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated insert messages" on public.messages;
create policy "Authenticated insert messages" on public.messages for insert with check (auth.role() = 'authenticated');

-- concept_cards
drop policy if exists "Authenticated manage concept cards" on public.concept_cards;
create policy "Authenticated manage concept cards" on public.concept_cards for all using (auth.role() = 'authenticated');

-- card_images
drop policy if exists "Authenticated read card images" on public.card_images;
create policy "Authenticated read card images" on public.card_images for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated insert card images" on public.card_images;
create policy "Authenticated insert card images" on public.card_images for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete card images" on public.card_images;
create policy "Authenticated delete card images" on public.card_images for delete using (auth.role() = 'authenticated');

-- card_comments
drop policy if exists "Authenticated read card comments" on public.card_comments;
create policy "Authenticated read card comments" on public.card_comments for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated insert card comments" on public.card_comments;
create policy "Authenticated insert card comments" on public.card_comments for insert with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- 8. REAL-TIME (so chat messages appear instantly)
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- DONE. You should see "Success. No rows returned".
-- ============================================================
