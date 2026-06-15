-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Submissions table
create table if not exists public.submissions (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  role text not null check (role in ('muse', 'photographer', 'stylist', 'mua')),
  wa_number text not null,
  notes text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected', 'archived')),
  details jsonb not null default '{}',
  edit_token uuid default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sessions table (Phase 2)
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

-- Session members table (Phase 2)
create table if not exists public.session_members (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  role text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(session_id, submission_id)
);

-- Chats table (Phase 3)
create table if not exists public.chats (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.sessions(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

-- Messages table (Phase 3)
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- Updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger submissions_updated_at
  before update on public.submissions
  for each row execute function public.handle_updated_at();

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.handle_updated_at();

-- RLS Policies
alter table public.submissions enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- Submissions: anyone can insert (public form), only authenticated users can read/update
create policy "Anyone can submit" on public.submissions
  for insert with check (true);

create policy "Authenticated users can read submissions" on public.submissions
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can update submissions" on public.submissions
  for update using (auth.role() = 'authenticated');

-- Sessions: only authenticated users
create policy "Authenticated users can manage sessions" on public.sessions
  for all using (auth.role() = 'authenticated');

-- Session members: only authenticated users
create policy "Authenticated users can manage session members" on public.session_members
  for all using (auth.role() = 'authenticated');

-- Chats: only authenticated users
create policy "Authenticated users can manage chats" on public.chats
  for all using (auth.role() = 'authenticated');

-- Messages: only authenticated users
create policy "Authenticated users can manage messages" on public.messages
  for all using (auth.role() = 'authenticated');
