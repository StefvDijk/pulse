-- workout_sessions: catch-all table for Apple Health workouts that are
-- not runs, padel, or gym sessions (cycling, swimming, hiking, HIIT, yoga, etc.)

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apple_health_id text,
  source text not null default 'apple_health',
  workout_type text not null default 'other',
  workout_name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  calories_burned numeric(7,1),
  created_at timestamptz default now(),
  unique (user_id, apple_health_id)
);

create index workout_sessions_user_started_at on workout_sessions(user_id, started_at desc);

alter table workout_sessions enable row level security;

create policy "Users can manage their own workout sessions"
  on workout_sessions for all
  using (auth.uid() = user_id);

-- Add other_minutes to daily_aggregations so the training load is complete
alter table daily_aggregations
  add column if not exists other_minutes integer not null default 0;

-- Add other_sessions to weekly_aggregations for context in check-in
alter table weekly_aggregations
  add column if not exists other_sessions integer not null default 0;
