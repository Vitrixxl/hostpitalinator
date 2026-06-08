PRAGMA legacy_alter_table = ON;

DROP TRIGGER IF EXISTS trg_patients_service_required_insert;
DROP TRIGGER IF EXISTS trg_patients_service_required_update;
DROP TRIGGER IF EXISTS trg_patients_service_exists_insert;
DROP TRIGGER IF EXISTS trg_patients_service_exists_update;
DROP TRIGGER IF EXISTS trg_patients_bed_service_matches_insert;
DROP TRIGGER IF EXISTS trg_patients_bed_service_matches_update;
DROP TRIGGER IF EXISTS trg_beds_occupied_service_matches_update;
DROP TRIGGER IF EXISTS trg_rooms_occupied_service_matches_update;
DROP TRIGGER IF EXISTS trg_evolution_notes_service_required_insert;
DROP TRIGGER IF EXISTS trg_evolution_notes_service_exists_insert;
DROP TRIGGER IF EXISTS trg_services_delete_unreferenced;

DROP INDEX IF EXISTS idx_patients_archived_at;
DROP INDEX IF EXISTS idx_patients_email;
DROP INDEX IF EXISTS idx_patients_bed_id;
DROP INDEX IF EXISTS idx_patients_active_bed;
DROP INDEX IF EXISTS idx_patients_current_service;
DROP INDEX IF EXISTS idx_patients_active_name;
DROP INDEX IF EXISTS idx_patients_service_active_name;
DROP INDEX IF EXISTS idx_vital_records_patient_recorded;
DROP INDEX IF EXISTS idx_vital_records_patient_recorded_created;
DROP INDEX IF EXISTS idx_prescriptions_patient;
DROP INDEX IF EXISTS idx_prescriptions_medicine_id;
DROP INDEX IF EXISTS idx_prescriptions_patient_start_created;
DROP INDEX IF EXISTS idx_medical_documents_patient_category;
DROP INDEX IF EXISTS idx_medical_documents_patient_created;
DROP INDEX IF EXISTS idx_medical_documents_patient_category_created;
DROP INDEX IF EXISTS idx_evolution_notes_patient_recorded;
DROP INDEX IF EXISTS idx_evolution_notes_patient_recorded_created;
DROP INDEX IF EXISTS idx_evolution_notes_service;
DROP INDEX IF EXISTS idx_lab_panels_patient_sampled;
DROP INDEX IF EXISTS idx_lab_panels_patient_sampled_created;
DROP INDEX IF EXISTS idx_lab_panel_results_panel_order;
DROP INDEX IF EXISTS idx_entrance_exams_patient_visit;
DROP INDEX IF EXISTS idx_entrance_exams_patient_created;
DROP INDEX IF EXISTS idx_entrance_exams_one_per_patient;
DROP INDEX IF EXISTS idx_patient_antecedents_patient_category;
DROP INDEX IF EXISTS idx_patient_doctor_followups_patient;
DROP INDEX IF EXISTS idx_patient_doctor_followups_doctor;
DROP INDEX IF EXISTS idx_patient_doctor_followups_patient_specialty;
DROP INDEX IF EXISTS idx_patient_doctor_followups_patient_active;

ALTER TABLE patients RENAME TO patients_previous;
ALTER TABLE vital_records RENAME TO vital_records_previous;
ALTER TABLE prescriptions RENAME TO prescriptions_previous;
ALTER TABLE medical_documents RENAME TO medical_documents_previous;
ALTER TABLE evolution_notes RENAME TO evolution_notes_previous;
ALTER TABLE lab_panels RENAME TO lab_panels_previous;
ALTER TABLE lab_panel_results RENAME TO lab_panel_results_previous;
ALTER TABLE entrance_exams RENAME TO entrance_exams_previous;
ALTER TABLE patient_antecedents RENAME TO patient_antecedents_previous;
ALTER TABLE patient_doctor_followups RENAME TO patient_doctor_followups_previous;

DROP TABLE IF EXISTS temp.patient_id_map;

CREATE TEMP TABLE patient_id_map (
  new_id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_id TEXT NOT NULL UNIQUE
);

INSERT INTO patient_id_map (old_id)
SELECT id
FROM patients_previous
ORDER BY created_at ASC, last_name ASC, first_name ASC, id ASC;

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  administrative_info TEXT,
  current_service TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT,
  bed_id TEXT REFERENCES beds(id) ON DELETE SET NULL,
  sex TEXT,
  address TEXT,
  phone_number TEXT,
  email TEXT,
  apartment_number TEXT,
  weight REAL,
  height REAL,
  current_visit_id TEXT,
  current_visit_started_at TEXT,
  contact_persons TEXT NOT NULL DEFAULT '[]',
  admission_reason TEXT
);

CREATE TABLE vital_records (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  recorded_at TEXT NOT NULL,
  temperature REAL NOT NULL,
  heart_rate INTEGER NOT NULL,
  systolic_blood_pressure INTEGER NOT NULL,
  diastolic_blood_pressure INTEGER NOT NULL,
  oxygen_saturation REAL NOT NULL,
  weight REAL NOT NULL,
  diuresis REAL,
  last_stool_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  height REAL,
  blood_glucose REAL,
  oxygen_therapy INTEGER NOT NULL DEFAULT 0,
  oxygen_flow_liters REAL
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  medication TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  route TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  prescriber TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  medicine_id TEXT REFERENCES medicines(id) ON DELETE RESTRICT
);

CREATE TABLE medical_documents (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('report', 'biology', 'imaging', 'prescription', 'letter', 'administrative')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  storage_path TEXT,
  mime_type TEXT,
  original_file_name TEXT,
  file_size_bytes INTEGER
);

CREATE TABLE evolution_notes (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  service TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (author_role IN ('admin', 'doctor', 'nurse', 'secretary')),
  recorded_at TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE lab_panels (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
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

CREATE TABLE entrance_exams (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  visit_id TEXT NOT NULL,
  service TEXT NOT NULL,
  admission_reason TEXT,
  lifestyle TEXT,
  entrance_treatment TEXT,
  disease_history TEXT,
  clinical_exam TEXT,
  allergies TEXT,
  synthesis TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (patient_id, visit_id)
);

CREATE TABLE patient_antecedents (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('pathology', 'medical_history', 'surgery')),
  source TEXT,
  code TEXT,
  label TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE patient_doctor_followups (
  id TEXT PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  specialty TEXT NOT NULL,
  specialty_search_text TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (end_date IS NULL OR end_date >= start_date),
  UNIQUE (patient_id, doctor_id, specialty, start_date)
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
  bed_id,
  sex,
  address,
  phone_number,
  email,
  apartment_number,
  weight,
  height,
  current_visit_id,
  current_visit_started_at,
  contact_persons,
  admission_reason
)
SELECT
  patient_id_map.new_id,
  patients_previous.first_name,
  patients_previous.last_name,
  patients_previous.birth_date,
  patients_previous.administrative_info,
  patients_previous.current_service,
  patients_previous.created_at,
  patients_previous.updated_at,
  patients_previous.archived_at,
  patients_previous.bed_id,
  patients_previous.sex,
  patients_previous.address,
  patients_previous.phone_number,
  patients_previous.email,
  patients_previous.apartment_number,
  patients_previous.weight,
  patients_previous.height,
  patients_previous.current_visit_id,
  patients_previous.current_visit_started_at,
  patients_previous.contact_persons,
  patients_previous.admission_reason
FROM patients_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = patients_previous.id;

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
  created_at,
  height,
  blood_glucose,
  oxygen_therapy,
  oxygen_flow_liters
)
SELECT
  vital_records_previous.id,
  patient_id_map.new_id,
  vital_records_previous.recorded_at,
  vital_records_previous.temperature,
  vital_records_previous.heart_rate,
  vital_records_previous.systolic_blood_pressure,
  vital_records_previous.diastolic_blood_pressure,
  vital_records_previous.oxygen_saturation,
  vital_records_previous.weight,
  vital_records_previous.diuresis,
  vital_records_previous.last_stool_date,
  vital_records_previous.created_at,
  vital_records_previous.height,
  vital_records_previous.blood_glucose,
  vital_records_previous.oxygen_therapy,
  vital_records_previous.oxygen_flow_liters
FROM vital_records_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = vital_records_previous.patient_id;

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
  updated_at,
  medicine_id
)
SELECT
  prescriptions_previous.id,
  patient_id_map.new_id,
  prescriptions_previous.medication,
  prescriptions_previous.dosage,
  prescriptions_previous.frequency,
  prescriptions_previous.route,
  prescriptions_previous.start_date,
  prescriptions_previous.end_date,
  prescriptions_previous.prescriber,
  prescriptions_previous.status,
  prescriptions_previous.created_at,
  prescriptions_previous.updated_at,
  prescriptions_previous.medicine_id
FROM prescriptions_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = prescriptions_previous.patient_id;

INSERT INTO medical_documents (
  id,
  patient_id,
  title,
  category,
  note,
  created_at,
  storage_path,
  mime_type,
  original_file_name,
  file_size_bytes
)
SELECT
  medical_documents_previous.id,
  patient_id_map.new_id,
  medical_documents_previous.title,
  medical_documents_previous.category,
  medical_documents_previous.note,
  medical_documents_previous.created_at,
  medical_documents_previous.storage_path,
  medical_documents_previous.mime_type,
  medical_documents_previous.original_file_name,
  medical_documents_previous.file_size_bytes
FROM medical_documents_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = medical_documents_previous.patient_id;

INSERT INTO evolution_notes (
  id,
  patient_id,
  service,
  visit_id,
  author,
  author_role,
  recorded_at,
  content,
  created_at
)
SELECT
  evolution_notes_previous.id,
  patient_id_map.new_id,
  evolution_notes_previous.service,
  evolution_notes_previous.visit_id,
  evolution_notes_previous.author,
  evolution_notes_previous.author_role,
  evolution_notes_previous.recorded_at,
  evolution_notes_previous.content,
  evolution_notes_previous.created_at
FROM evolution_notes_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = evolution_notes_previous.patient_id;

INSERT INTO lab_panels (
  id,
  patient_id,
  sampled_at,
  panel_type,
  status,
  created_at
)
SELECT
  lab_panels_previous.id,
  patient_id_map.new_id,
  lab_panels_previous.sampled_at,
  lab_panels_previous.panel_type,
  lab_panels_previous.status,
  lab_panels_previous.created_at
FROM lab_panels_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = lab_panels_previous.patient_id;

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
FROM lab_panel_results_previous;

INSERT INTO entrance_exams (
  id,
  patient_id,
  visit_id,
  service,
  admission_reason,
  lifestyle,
  entrance_treatment,
  disease_history,
  clinical_exam,
  allergies,
  synthesis,
  created_at,
  updated_at
)
SELECT
  entrance_exams_previous.id,
  patient_id_map.new_id,
  entrance_exams_previous.visit_id,
  entrance_exams_previous.service,
  entrance_exams_previous.admission_reason,
  entrance_exams_previous.lifestyle,
  entrance_exams_previous.entrance_treatment,
  entrance_exams_previous.disease_history,
  entrance_exams_previous.clinical_exam,
  entrance_exams_previous.allergies,
  entrance_exams_previous.synthesis,
  entrance_exams_previous.created_at,
  entrance_exams_previous.updated_at
FROM entrance_exams_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = entrance_exams_previous.patient_id;

INSERT INTO patient_antecedents (
  id,
  patient_id,
  category,
  source,
  code,
  label,
  notes,
  created_at,
  updated_at
)
SELECT
  patient_antecedents_previous.id,
  patient_id_map.new_id,
  patient_antecedents_previous.category,
  patient_antecedents_previous.source,
  patient_antecedents_previous.code,
  patient_antecedents_previous.label,
  patient_antecedents_previous.notes,
  patient_antecedents_previous.created_at,
  patient_antecedents_previous.updated_at
FROM patient_antecedents_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = patient_antecedents_previous.patient_id;

INSERT INTO patient_doctor_followups (
  id,
  patient_id,
  doctor_id,
  specialty,
  specialty_search_text,
  start_date,
  end_date,
  created_at,
  updated_at
)
SELECT
  patient_doctor_followups_previous.id,
  patient_id_map.new_id,
  patient_doctor_followups_previous.doctor_id,
  patient_doctor_followups_previous.specialty,
  patient_doctor_followups_previous.specialty_search_text,
  patient_doctor_followups_previous.start_date,
  patient_doctor_followups_previous.end_date,
  patient_doctor_followups_previous.created_at,
  patient_doctor_followups_previous.updated_at
FROM patient_doctor_followups_previous
INNER JOIN patient_id_map ON patient_id_map.old_id = patient_doctor_followups_previous.patient_id;

DROP TABLE vital_records_previous;
DROP TABLE prescriptions_previous;
DROP TABLE medical_documents_previous;
DROP TABLE evolution_notes_previous;
DROP TABLE entrance_exams_previous;
DROP TABLE patient_antecedents_previous;
DROP TABLE patient_doctor_followups_previous;
DROP TABLE lab_panel_results_previous;
DROP TABLE lab_panels_previous;
DROP TABLE patients_previous;

CREATE INDEX IF NOT EXISTS idx_patients_archived_at ON patients(archived_at);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_bed_id ON patients(bed_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_active_bed
  ON patients(bed_id)
  WHERE bed_id IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_current_service ON patients(current_service);
CREATE INDEX IF NOT EXISTS idx_patients_active_name
  ON patients(archived_at, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_service_active_name
  ON patients(current_service, archived_at, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_vital_records_patient_recorded
  ON vital_records(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vital_records_patient_recorded_created
  ON vital_records(patient_id, recorded_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medicine_id ON prescriptions(medicine_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_start_created
  ON prescriptions(patient_id, start_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_category
  ON medical_documents(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_created
  ON medical_documents(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_category_created
  ON medical_documents(patient_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evolution_notes_patient_recorded
  ON evolution_notes(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_notes_patient_recorded_created
  ON evolution_notes(patient_id, recorded_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_notes_service ON evolution_notes(service);

CREATE INDEX IF NOT EXISTS idx_lab_panels_patient_sampled
  ON lab_panels(patient_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_panels_patient_sampled_created
  ON lab_panels(patient_id, sampled_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_panel_results_panel_order
  ON lab_panel_results(lab_panel_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_entrance_exams_patient_visit
  ON entrance_exams(patient_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_entrance_exams_patient_created
  ON entrance_exams(patient_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entrance_exams_one_per_patient
  ON entrance_exams(patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_antecedents_patient_category
  ON patient_antecedents(patient_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_patient
  ON patient_doctor_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_doctor
  ON patient_doctor_followups(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_patient_specialty
  ON patient_doctor_followups(patient_id, specialty_search_text);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_patient_active
  ON patient_doctor_followups(patient_id, end_date);

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

CREATE TRIGGER IF NOT EXISTS trg_rooms_occupied_service_matches_update
BEFORE UPDATE OF service ON rooms
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM beds
  JOIN patients ON patients.bed_id = beds.id
  WHERE beds.room_id = NEW.id
    AND patients.archived_at IS NULL
    AND patients.current_service != NEW.service
)
BEGIN
  SELECT RAISE(ABORT, 'Occupied room service must match patient service');
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

DROP TABLE IF EXISTS temp.patient_id_map;

PRAGMA legacy_alter_table = OFF;
