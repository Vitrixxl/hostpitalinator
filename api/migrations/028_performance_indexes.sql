CREATE INDEX IF NOT EXISTS idx_patients_active_name
  ON patients(archived_at, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_patients_service_active_name
  ON patients(current_service, archived_at, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_vital_records_patient_recorded_created
  ON vital_records(patient_id, recorded_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_start_created
  ON prescriptions(patient_id, start_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_panels_patient_sampled_created
  ON lab_panels(patient_id, sampled_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_created
  ON medical_documents(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_category_created
  ON medical_documents(patient_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evolution_notes_patient_recorded_created
  ON evolution_notes(patient_id, recorded_at DESC, created_at DESC);
