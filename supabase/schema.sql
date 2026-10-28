-- 韭菜进化论 · 联机版 Supabase schema
-- 在 Supabase Dashboard → SQL Editor 里整段运行。
-- 匿名登录需要在 Authentication → Providers → Anonymous 里开启。

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '韭菜同学',
  avatar text not null default '🌱',
  level int not null default 1,
  xp int not null default 0,
  streak int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- saves (single-player cloud save)
-- ---------------------------------------------------------------------------
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves read own" on public.saves;
create policy "saves read own"
  on public.saves for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "saves insert own" on public.saves;
create policy "saves insert own"
  on public.saves for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "saves update own" on public.saves;
create policy "saves update own"
  on public.saves for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "saves delete own" on public.saves;
create policy "saves delete own"
  on public.saves for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  game text not null check (game in ('coop', 'portfolio')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  host_id uuid not null references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_status_idx on public.rooms (status);

alter table public.rooms enable row level security;

drop policy if exists "rooms readable" on public.rooms;
create policy "rooms readable"
  on public.rooms for select
  to authenticated
  using (true);

drop policy if exists "rooms insert host" on public.rooms;
create policy "rooms insert host"
  on public.rooms for insert
  to authenticated
  with check (host_id = auth.uid());

drop policy if exists "rooms update host" on public.rooms;
create policy "rooms update host"
  on public.rooms for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists "rooms delete host" on public.rooms;
create policy "rooms delete host"
  on public.rooms for delete
  to authenticated
  using (host_id = auth.uid());

-- ---------------------------------------------------------------------------
-- room_players
-- ---------------------------------------------------------------------------
create table if not exists public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  choice jsonb,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_players_room_idx on public.room_players (room_id);

alter table public.room_players enable row level security;

drop policy if exists "room_players readable" on public.room_players;
create policy "room_players readable"
  on public.room_players for select
  to authenticated
  using (true);

drop policy if exists "room_players insert self" on public.room_players;
create policy "room_players insert self"
  on public.room_players for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "room_players update self" on public.room_players;
create policy "room_players update self"
  on public.room_players for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "room_players delete self" on public.room_players;
create policy "room_players delete self"
  on public.room_players for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null default '韭菜同学',
  kind text not null default 'activity',
  text text not null,
  room_id uuid,
  created_at timestamptz not null default now()
);

alter table public.activities add column if not exists nickname text not null default '韭菜同学';

create index if not exists activities_created_idx on public.activities (created_at desc);
create index if not exists activities_room_idx on public.activities (room_id);

alter table public.activities enable row level security;

drop policy if exists "activities readable" on public.activities;
create policy "activities readable"
  on public.activities for select
  to authenticated
  using (true);

drop policy if exists "activities insert own" on public.activities;
create policy "activities insert own"
  on public.activities for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before update on public.saves
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'activities', 'rooms', 'room_players']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      raise notice 'already in realtime publication: %', t;
    end;
  end loop;
end $$;

-- 完成。匿名登录需在 Dashboard 手动开启：
-- Authentication → Providers → Anonymous → Enable
