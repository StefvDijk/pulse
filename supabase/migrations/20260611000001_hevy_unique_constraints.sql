-- Hevy ingest deduplication + unique constraints
--
-- Context: the Hevy sync flow (src/lib/hevy/sync.ts) uses a delete-then-insert
-- strategy for exercises/sets, so it never creates duplicates. The webhook,
-- however, used a constraint-less .upsert() (which falls back to INSERT),
-- doubling rows on every redelivery/edit. We now route both paths through
-- delete-then-insert AND add the unique constraints below so the DB itself
-- guards against accidental duplication.
--
-- Step 1: clean up any duplicates the old webhook may have created.
--   Keep the row with the lowest id per duplicate group; delete the rest.
--   Sets are deleted first because their grouping key (workout_exercise_id)
--   would be orphaned once we remove duplicate exercises (FK is ON DELETE
--   CASCADE, but we delete sets explicitly to keep the dedupe deterministic).

-- 1a. De-duplicate workout_sets within each (workout_exercise_id, set_order).
DELETE FROM workout_sets ws
USING workout_sets keep
WHERE ws.workout_exercise_id = keep.workout_exercise_id
  AND ws.set_order = keep.set_order
  AND ws.id > keep.id;

-- 1b. De-duplicate workout_exercises within each (workout_id, exercise_order).
--   Sets attached to the discarded exercises cascade away via the FK.
DELETE FROM workout_exercises we
USING workout_exercises keep
WHERE we.workout_id = keep.workout_id
  AND we.exercise_order = keep.exercise_order
  AND we.id > keep.id;

-- 1c. Re-run set dedupe in case cascade left no duplicates but the first pass
--   ran before exercise dedupe. Idempotent — safe to run twice.
DELETE FROM workout_sets ws
USING workout_sets keep
WHERE ws.workout_exercise_id = keep.workout_exercise_id
  AND ws.set_order = keep.set_order
  AND ws.id > keep.id;

-- Step 2: add the unique constraints so upserts have a real conflict target
-- and duplicate inserts fail loudly instead of silently doubling data.
ALTER TABLE workout_exercises
  ADD CONSTRAINT workout_exercises_workout_id_exercise_order_key
  UNIQUE (workout_id, exercise_order);

ALTER TABLE workout_sets
  ADD CONSTRAINT workout_sets_workout_exercise_id_set_order_key
  UNIQUE (workout_exercise_id, set_order);
