-- Migration 008: Row Level Security policies

-- Enable RLS op alle tabellen
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE padel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_block_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_aggregations ENABLE ROW LEVEL SECURITY;

-- profiles: gebruikers kunnen alleen hun eigen profiel zien/aanpassen
CREATE POLICY "Users can manage own profile"
    ON profiles FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- user_settings
CREATE POLICY "Users can manage own settings"
    ON user_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- exercise_definitions: iedereen kan lezen (reference tabel), niemand schrijft via client
CREATE POLICY "Exercise definitions are publicly readable"
    ON exercise_definitions FOR SELECT
    USING (true);

-- workouts
CREATE POLICY "Users can manage own workouts"
    ON workouts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- workout_exercises (via workout ownership)
CREATE POLICY "Users can manage own workout exercises"
    ON workout_exercises FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workouts
            WHERE workouts.id = workout_exercises.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

-- workout_sets (via workout_exercise → workout ownership)
CREATE POLICY "Users can manage own workout sets"
    ON workout_sets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_exercises we
            JOIN workouts w ON w.id = we.workout_id
            WHERE we.id = workout_sets.workout_exercise_id
            AND w.user_id = auth.uid()
        )
    );

-- runs
CREATE POLICY "Users can manage own runs"
    ON runs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- padel_sessions
CREATE POLICY "Users can manage own padel sessions"
    ON padel_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- daily_activity
CREATE POLICY "Users can manage own daily activity"
    ON daily_activity FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- nutrition_logs
CREATE POLICY "Users can manage own nutrition logs"
    ON nutrition_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- daily_nutrition_summary
CREATE POLICY "Users can manage own nutrition summary"
    ON daily_nutrition_summary FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- chat_sessions
CREATE POLICY "Users can manage own chat sessions"
    ON chat_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "Users can manage own chat messages"
    ON chat_messages FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- injury_logs
CREATE POLICY "Users can manage own injury logs"
    ON injury_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- training_schemas
CREATE POLICY "Users can manage own training schemas"
    ON training_schemas FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- schema_block_summaries
CREATE POLICY "Users can manage own schema summaries"
    ON schema_block_summaries FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- goals
CREATE POLICY "Users can manage own goals"
    ON goals FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- personal_records
CREATE POLICY "Users can manage own personal records"
    ON personal_records FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- aggregations
CREATE POLICY "Users can manage own daily aggregations"
    ON daily_aggregations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own weekly aggregations"
    ON weekly_aggregations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own monthly aggregations"
    ON monthly_aggregations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger: auto-create profiel bij nieuwe gebruiker
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
