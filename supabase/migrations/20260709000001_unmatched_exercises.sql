-- Audit v2 (DATA-H2): when a Hevy exercise name doesn't match any
-- exercise_definition, the whole exercise + its sets were silently dropped
-- (workout_exercises.exercise_definition_id is NOT NULL) with only a
-- console.warn. Tonnage/PR/ACWR then ran on incomplete data with no trace.
-- This table records unmatched names so they're visible and fixable.

create table if not exists public.unmatched_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hevy_exercise_name text not null,
  last_hevy_workout_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved boolean not null default false,
  unique (user_id, hevy_exercise_name)
);

create index if not exists idx_unmatched_exercises_user
  on public.unmatched_exercises (user_id, resolved, last_seen_at desc);

alter table public.unmatched_exercises enable row level security;

create policy "Users manage own unmatched exercises"
  on public.unmatched_exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
