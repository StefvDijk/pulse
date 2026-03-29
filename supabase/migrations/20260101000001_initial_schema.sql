-- Migration 001: Core tabellen
-- profiles, user_settings, workouts, exercise_definitions, workout_exercises, workout_sets

-- Gebruikersprofiel
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    date_of_birth DATE,
    weight_kg DECIMAL(5,1),
    height_cm INTEGER,
    activity_level TEXT DEFAULT 'moderate' CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'very_active')),
    dietary_preference TEXT DEFAULT 'omnivore' CHECK (dietary_preference IN ('omnivore', 'vegetarian', 'vegan', 'pescatarian')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gebruikersinstellingen
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    hevy_api_key TEXT,
    health_auto_export_token TEXT,
    protein_target_per_kg DECIMAL(3,1) DEFAULT 1.8,
    preferred_unit_system TEXT DEFAULT 'metric' CHECK (preferred_unit_system IN ('metric', 'imperial')),
    weekly_training_target JSONB DEFAULT '{"gym": 3, "running": 2, "padel": 1}',
    last_hevy_sync_at TIMESTAMPTZ,
    last_apple_health_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercise definities (reference tabel)
CREATE TABLE exercise_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hevy_exercise_id TEXT,
    name TEXT NOT NULL,
    primary_muscle_group TEXT NOT NULL CHECK (primary_muscle_group IN (
        'chest', 'upper_back', 'lats', 'shoulders', 'biceps', 'triceps',
        'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'core',
        'hip_flexors', 'rotator_cuff'
    )),
    secondary_muscle_groups TEXT[] DEFAULT '{}',
    movement_pattern TEXT NOT NULL CHECK (movement_pattern IN (
        'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
        'squat', 'hinge', 'lunge', 'carry', 'isolation', 'core'
    )),
    equipment TEXT CHECK (equipment IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other')),
    is_compound BOOLEAN DEFAULT false,
    sport_specificity TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name)
);

-- Workouts (gym sessies van Hevy)
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    hevy_workout_id TEXT,
    title TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'hevy' CHECK (source IN ('hevy', 'manual')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, hevy_workout_id)
);

-- Workout exercises (oefeningen binnen een workout)
CREATE TABLE workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_definition_id UUID NOT NULL REFERENCES exercise_definitions(id),
    exercise_order INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sets (individuele sets binnen een exercise)
CREATE TABLE workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_order INTEGER NOT NULL,
    set_type TEXT DEFAULT 'normal' CHECK (set_type IN ('normal', 'warmup', 'dropset', 'failure')),
    weight_kg DECIMAL(6,2),
    reps INTEGER,
    distance_meters DECIMAL(8,1),
    duration_seconds INTEGER,
    rpe DECIMAL(3,1) CHECK (rpe >= 1 AND rpe <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger om updated_at bij te houden
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
