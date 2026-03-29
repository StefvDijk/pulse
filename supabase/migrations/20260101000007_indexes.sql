-- Migration 007: Performance indexen

CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at DESC);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(workout_exercise_id);
CREATE INDEX idx_runs_user_date ON runs(user_id, started_at DESC);
CREATE INDEX idx_padel_user_date ON padel_sessions(user_id, started_at DESC);
CREATE INDEX idx_daily_activity_user_date ON daily_activity(user_id, date DESC);
CREATE INDEX idx_daily_agg_user_date ON daily_aggregations(user_id, date DESC);
CREATE INDEX idx_weekly_agg_user_week ON weekly_aggregations(user_id, week_start DESC);
CREATE INDEX idx_monthly_agg_user_month ON monthly_aggregations(user_id, year DESC, month DESC);
CREATE INDEX idx_nutrition_logs_user_date ON nutrition_logs(user_id, date DESC);
CREATE INDEX idx_daily_nutrition_user_date ON daily_nutrition_summary(user_id, date DESC);
CREATE INDEX idx_injury_logs_user_date ON injury_logs(user_id, date DESC);
CREATE INDEX idx_chat_messages_user_session ON chat_messages(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_schemas_user_active ON training_schemas(user_id, is_active);
CREATE INDEX idx_prs_user_exercise ON personal_records(user_id, exercise_definition_id, achieved_at DESC);
CREATE INDEX idx_exercise_definitions_name ON exercise_definitions(name);
CREATE INDEX idx_exercise_definitions_hevy_id ON exercise_definitions(hevy_exercise_id);
