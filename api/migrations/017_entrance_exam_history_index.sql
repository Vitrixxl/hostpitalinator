CREATE INDEX IF NOT EXISTS idx_entrance_exams_patient_created
  ON entrance_exams(patient_id, created_at DESC);
