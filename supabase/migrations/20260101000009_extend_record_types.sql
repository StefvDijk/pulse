-- Extend personal_records record_type to support body composition data (InBody scans)
ALTER TABLE personal_records
    DROP CONSTRAINT personal_records_record_type_check;

ALTER TABLE personal_records
    ADD CONSTRAINT personal_records_record_type_check
    CHECK (record_type IN (
        'weight', 'reps', 'distance', 'pace', 'duration',
        'muscle_mass', 'fat_mass', 'body_fat_percentage', 'bmi', 'visceral_fat'
    ));

-- Extend exercise_definitions movement_pattern to support carry exercises (Farmer's Walk)
ALTER TABLE exercise_definitions
    DROP CONSTRAINT exercise_definitions_movement_pattern_check;

ALTER TABLE exercise_definitions
    ADD CONSTRAINT exercise_definitions_movement_pattern_check
    CHECK (movement_pattern IN (
        'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
        'squat', 'hinge', 'lunge', 'core', 'isolation', 'carry'
    ));
