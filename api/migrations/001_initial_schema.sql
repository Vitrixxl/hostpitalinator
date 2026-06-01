CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'nurse', 'secretary')),
  service TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  ipp TEXT NOT NULL UNIQUE,
  administrative_info TEXT,
  current_service TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS vital_records (
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

CREATE TABLE IF NOT EXISTS prescriptions (
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

CREATE TABLE IF NOT EXISTS lab_results (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  sampled_at TEXT NOT NULL,
  panel_type TEXT NOT NULL,
  marker TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT NOT NULL,
  reference_interval TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS medical_documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('report', 'biology', 'imaging', 'prescription', 'letter', 'administrative')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  storage_path TEXT,
  mime_type TEXT
);

CREATE TABLE IF NOT EXISTS evolution_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  service TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  author TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_patients_ipp ON patients(ipp);
CREATE INDEX IF NOT EXISTS idx_patients_archived_at ON patients(archived_at);
CREATE INDEX IF NOT EXISTS idx_vital_records_patient_recorded ON vital_records(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_sampled ON lab_results(patient_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_category ON medical_documents(patient_id, category);
CREATE INDEX IF NOT EXISTS idx_evolution_notes_patient_recorded ON evolution_notes(patient_id, recorded_at DESC);
