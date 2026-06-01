PRAGMA legacy_alter_table = ON;

DROP TRIGGER IF EXISTS trg_patients_service_required_insert;
DROP TRIGGER IF EXISTS trg_patients_service_required_update;
DROP TRIGGER IF EXISTS trg_patients_service_exists_insert;
DROP TRIGGER IF EXISTS trg_patients_service_exists_update;
DROP TRIGGER IF EXISTS trg_patients_bed_service_matches_insert;
DROP TRIGGER IF EXISTS trg_patients_bed_service_matches_update;
DROP TRIGGER IF EXISTS trg_beds_occupied_service_matches_update;
DROP TRIGGER IF EXISTS trg_evolution_notes_service_required_insert;
DROP TRIGGER IF EXISTS trg_evolution_notes_service_exists_insert;
DROP TRIGGER IF EXISTS trg_services_delete_unreferenced;

DROP INDEX IF EXISTS idx_patients_ipp;
DROP INDEX IF EXISTS idx_patients_archived_at;
DROP INDEX IF EXISTS idx_patients_bed_id;
DROP INDEX IF EXISTS idx_patients_active_bed;
DROP INDEX IF EXISTS idx_patients_current_service;
DROP INDEX IF EXISTS idx_vital_records_patient_recorded;
DROP INDEX IF EXISTS idx_prescriptions_patient;
DROP INDEX IF EXISTS idx_medical_documents_patient_category;
DROP INDEX IF EXISTS idx_evolution_notes_patient_recorded;
DROP INDEX IF EXISTS idx_evolution_notes_service;
DROP INDEX IF EXISTS idx_lab_panels_patient_sampled;
DROP INDEX IF EXISTS idx_lab_panel_results_panel_order;

ALTER TABLE patients RENAME TO patients_previous;
ALTER TABLE vital_records RENAME TO vital_records_with_patient_ref;
ALTER TABLE prescriptions RENAME TO prescriptions_with_patient_ref;
ALTER TABLE medical_documents RENAME TO medical_documents_with_patient_ref;
ALTER TABLE evolution_notes RENAME TO evolution_notes_with_patient_ref;
ALTER TABLE lab_panels RENAME TO lab_panels_with_patient_ref;
ALTER TABLE lab_panel_results RENAME TO lab_panel_results_with_panel_ref;

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  administrative_info TEXT,
  current_service TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT,
  bed_id TEXT REFERENCES beds(id) ON DELETE SET NULL
);

CREATE TABLE vital_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  recorded_at TEXT NOT NULL,
  temperature REAL NOT NULL,
  heart_rate INTEGER NOT NULL,
  systolic_blood_pressure INTEGER NOT NULL,
  diastolic_blood_pressure INTEGER NOT NULL,
  oxygen_saturation REAL NOT NULL,
  weight REAL NOT NULL,
  diuresis REAL,
  last_stool_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  medication TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  route TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  prescriber TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE medical_documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('report', 'biology', 'imaging', 'prescription', 'letter', 'administrative')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  storage_path TEXT,
  mime_type TEXT,
  original_file_name TEXT,
  file_size_bytes INTEGER
);

CREATE TABLE evolution_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  service TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  author TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE lab_panels (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  sampled_at TEXT NOT NULL,
  panel_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE lab_panel_results (
  id TEXT PRIMARY KEY,
  lab_panel_id TEXT NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
  marker_key TEXT NOT NULL,
  marker_label TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT NOT NULL,
  reference_interval TEXT NOT NULL,
  status TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO patients (
  id,
  first_name,
  last_name,
  birth_date,
  administrative_info,
  current_service,
  created_at,
  updated_at,
  archived_at,
  bed_id
)
SELECT
  id,
  first_name,
  last_name,
  birth_date,
  administrative_info,
  current_service,
  created_at,
  updated_at,
  archived_at,
  bed_id
FROM patients_previous;

INSERT INTO vital_records (
  id,
  patient_id,
  recorded_at,
  temperature,
  heart_rate,
  systolic_blood_pressure,
  diastolic_blood_pressure,
  oxygen_saturation,
  weight,
  diuresis,
  last_stool_date,
  created_at
)
SELECT
  id,
  patient_id,
  recorded_at,
  temperature,
  heart_rate,
  systolic_blood_pressure,
  diastolic_blood_pressure,
  oxygen_saturation,
  weight,
  diuresis,
  last_stool_date,
  created_at
FROM vital_records_with_patient_ref;

INSERT INTO prescriptions (
  id,
  patient_id,
  medication,
  dosage,
  frequency,
  route,
  start_date,
  end_date,
  prescriber,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  patient_id,
  medication,
  dosage,
  frequency,
  route,
  start_date,
  end_date,
  prescriber,
  status,
  created_at,
  updated_at
FROM prescriptions_with_patient_ref;

INSERT INTO medical_documents (
  id,
  patient_id,
  title,
  category,
  created_at,
  storage_path,
  mime_type,
  original_file_name,
  file_size_bytes
)
SELECT
  id,
  patient_id,
  title,
  category,
  created_at,
  storage_path,
  mime_type,
  original_file_name,
  file_size_bytes
FROM medical_documents_with_patient_ref;

INSERT INTO evolution_notes (
  id,
  patient_id,
  service,
  visit_id,
  author,
  recorded_at,
  content,
  created_at
)
SELECT
  id,
  patient_id,
  service,
  visit_id,
  author,
  recorded_at,
  content,
  created_at
FROM evolution_notes_with_patient_ref;

INSERT INTO lab_panels (
  id,
  patient_id,
  sampled_at,
  panel_type,
  status,
  created_at
)
SELECT
  id,
  patient_id,
  sampled_at,
  panel_type,
  status,
  created_at
FROM lab_panels_with_patient_ref;

INSERT INTO lab_panel_results (
  id,
  lab_panel_id,
  marker_key,
  marker_label,
  value,
  unit,
  reference_interval,
  status,
  sort_order
)
SELECT
  id,
  lab_panel_id,
  marker_key,
  marker_label,
  value,
  unit,
  reference_interval,
  status,
  sort_order
FROM lab_panel_results_with_panel_ref;

DROP TABLE lab_panel_results_with_panel_ref;
DROP TABLE lab_panels_with_patient_ref;
DROP TABLE evolution_notes_with_patient_ref;
DROP TABLE medical_documents_with_patient_ref;
DROP TABLE prescriptions_with_patient_ref;
DROP TABLE vital_records_with_patient_ref;
DROP TABLE patients_previous;

PRAGMA legacy_alter_table = OFF;

CREATE INDEX IF NOT EXISTS idx_patients_archived_at ON patients(archived_at);
CREATE INDEX IF NOT EXISTS idx_patients_bed_id ON patients(bed_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_active_bed
  ON patients(bed_id)
  WHERE bed_id IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_current_service ON patients(current_service);
CREATE INDEX IF NOT EXISTS idx_vital_records_patient_recorded
  ON vital_records(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_category
  ON medical_documents(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_evolution_notes_patient_recorded
  ON evolution_notes(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_notes_service ON evolution_notes(service);
CREATE INDEX IF NOT EXISTS idx_lab_panels_patient_sampled
  ON lab_panels(patient_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_panel_results_panel_order
  ON lab_panel_results(lab_panel_id, sort_order ASC);

CREATE TRIGGER IF NOT EXISTS trg_patients_service_required_insert
BEFORE INSERT ON patients
FOR EACH ROW
WHEN NEW.current_service IS NULL OR trim(NEW.current_service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Patient service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_patients_service_required_update
BEFORE UPDATE OF current_service ON patients
FOR EACH ROW
WHEN NEW.current_service IS NULL OR trim(NEW.current_service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Patient service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_patients_service_exists_insert
BEFORE INSERT ON patients
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.current_service)
BEGIN
  SELECT RAISE(ABORT, 'Patient service must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_patients_service_exists_update
BEFORE UPDATE OF current_service ON patients
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.current_service)
BEGIN
  SELECT RAISE(ABORT, 'Patient service must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_patients_bed_service_matches_insert
BEFORE INSERT ON patients
FOR EACH ROW
WHEN NEW.bed_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM beds WHERE id = NEW.bed_id AND service = NEW.current_service
  )
BEGIN
  SELECT RAISE(ABORT, 'Patient bed must belong to patient service');
END;

CREATE TRIGGER IF NOT EXISTS trg_patients_bed_service_matches_update
BEFORE UPDATE OF current_service, bed_id ON patients
FOR EACH ROW
WHEN NEW.bed_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM beds WHERE id = NEW.bed_id AND service = NEW.current_service
  )
BEGIN
  SELECT RAISE(ABORT, 'Patient bed must belong to patient service');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_occupied_service_matches_update
BEFORE UPDATE OF service ON beds
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM patients
  WHERE bed_id = NEW.id
    AND archived_at IS NULL
    AND current_service != NEW.service
)
BEGIN
  SELECT RAISE(ABORT, 'Occupied bed service must match patient service');
END;

CREATE TRIGGER IF NOT EXISTS trg_evolution_notes_service_required_insert
BEFORE INSERT ON evolution_notes
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Evolution note service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_evolution_notes_service_exists_insert
BEFORE INSERT ON evolution_notes
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Evolution note service must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_services_delete_unreferenced
BEFORE DELETE ON services
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM accounts WHERE service = OLD.name)
  OR EXISTS (SELECT 1 FROM patients WHERE current_service = OLD.name)
  OR EXISTS (SELECT 1 FROM beds WHERE service = OLD.name)
  OR EXISTS (SELECT 1 FROM evolution_notes WHERE service = OLD.name)
BEGIN
  SELECT RAISE(ABORT, 'Service is still referenced');
END;
