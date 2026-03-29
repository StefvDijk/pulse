-- Migration 003: Voeding tabellen

-- Voedingslogs (natural language input + AI analyse)
CREATE TABLE nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_of_day TIME,
    raw_input TEXT NOT NULL,
    estimated_calories DECIMAL(7,1),
    estimated_protein_g DECIMAL(5,1),
    estimated_carbs_g DECIMAL(5,1),
    estimated_fat_g DECIMAL(5,1),
    estimated_fiber_g DECIMAL(5,1),
    ai_analysis TEXT,
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dagelijkse voeding samenvatting (berekend)
CREATE TABLE daily_nutrition_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_calories DECIMAL(7,1),
    total_protein_g DECIMAL(5,1),
    total_carbs_g DECIMAL(5,1),
    total_fat_g DECIMAL(5,1),
    total_fiber_g DECIMAL(5,1),
    protein_target_g DECIMAL(5,1),
    calorie_target DECIMAL(7,1),
    protein_status TEXT CHECK (protein_status IN ('under', 'on_track', 'over')),
    calorie_status TEXT CHECK (calorie_status IN ('under', 'on_track', 'over')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TRIGGER update_daily_nutrition_summary_updated_at
    BEFORE UPDATE ON daily_nutrition_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
