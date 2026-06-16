-- Generieke activiteiten-tabel voor sporten buiten runs/workouts/walks/padel_sessions.
-- Hybride model: bestaande sport-tabellen blijven; deze vangt tennis/squash/hiit/
-- voetbal/yoga/fietsen/zwemmen/overig uit Apple Health en Strava.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_key text not null,
  source text not null,
  apple_health_id text,
  strava_activity_id bigint,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  distance_meters integer,
  calories_burned integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  elevation_gain_meters integer,
  intensity text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists activities_user_apple
  on public.activities (user_id, apple_health_id) where apple_health_id is not null;
create unique index if not exists activities_user_strava
  on public.activities (user_id, strava_activity_id) where strava_activity_id is not null;
create index if not exists activities_user_started
  on public.activities (user_id, started_at desc);

alter table public.activities enable row level security;

create policy "activities_select_own" on public.activities
  for select using (auth.uid() = user_id);
create policy "activities_insert_own" on public.activities
  for insert with check (auth.uid() = user_id);
create policy "activities_update_own" on public.activities
  for update using (auth.uid() = user_id);
create policy "activities_delete_own" on public.activities
  for delete using (auth.uid() = user_id);
