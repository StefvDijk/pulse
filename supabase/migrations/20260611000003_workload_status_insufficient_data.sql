-- workload_status kreeg in code de waarde 'insufficient_data' (geen verzonnen
-- ACWR 1.0 meer bij ontbrekende historie); de CHECK-constraint moet die kennen.
ALTER TABLE weekly_aggregations
  DROP CONSTRAINT IF EXISTS weekly_aggregations_workload_status_check;

ALTER TABLE weekly_aggregations
  ADD CONSTRAINT weekly_aggregations_workload_status_check
  CHECK (workload_status IN ('low', 'optimal', 'warning', 'danger', 'insufficient_data'));
