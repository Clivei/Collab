-- Add email to submissions
alter table public.submissions add column if not exists email text;
alter table public.submissions add column if not exists user_id uuid references auth.users(id);

-- Concept cards
create table if not exists public.concept_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image_url text,
  cover_image_type text check (cover_image_type in ('upload', 'gdrive')),
  tags text[] default '{}',
  session_id uuid references public.sessions(id) on delete set null,
  created_by uuid references auth.users(id),
  status text not null default 'idea' check (status in ('idea', 'active', 'done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.concept_cards(id) on delete cascade,
  url text not null,
  type text not null check (type in ('upload', 'gdrive')),
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.concept_cards(id) on delete cascade,
  user_id uuid references auth.users(id),
  author_name text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages add column if not exists sender_name text;

create trigger concept_cards_updated_at
  before update on public.concept_cards
  for each row execute function public.handle_updated_at();

alter table public.concept_cards enable row level security;
alter table public.card_images enable row level security;
alter table public.card_comments enable row level security;

create policy "Authenticated manage concept cards" on public.concept_cards
  for all using (auth.role() = 'authenticated');

create policy "Authenticated read card images" on public.card_images
  for select using (auth.role() = 'authenticated');
create policy "Authenticated insert card images" on public.card_images
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated delete card images" on public.card_images
  for delete using (auth.role() = 'authenticated');

create policy "Authenticated read card comments" on public.card_comments
  for select using (auth.role() = 'authenticated');
create policy "Authenticated insert card comments" on public.card_comments
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated read messages" on public.messages
  for select using (auth.role() = 'authenticated');
create policy "Authenticated insert messages" on public.messages
  for insert with check (auth.role() = 'authenticated');
