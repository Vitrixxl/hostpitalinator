ALTER TABLE patients ADD COLUMN current_visit_id TEXT;
ALTER TABLE patients ADD COLUMN current_visit_started_at TEXT;

UPDATE patients
SET current_visit_id = 'VIS-' || replace(substr(created_at, 1, 10), '-', ''),
    current_visit_started_at = created_at
WHERE current_visit_id IS NULL;
