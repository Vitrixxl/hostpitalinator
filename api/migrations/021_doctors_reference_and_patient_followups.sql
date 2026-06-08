CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  national_id TEXT NOT NULL DEFAULT '',
  civility TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  profession_code TEXT NOT NULL DEFAULT '10',
  profession_label TEXT NOT NULL DEFAULT 'Médecin',
  category_code TEXT NOT NULL DEFAULT '',
  category_label TEXT NOT NULL DEFAULT '',
  specialties TEXT NOT NULL DEFAULT '',
  specialty_codes TEXT NOT NULL DEFAULT '',
  specialty_search_text TEXT NOT NULL DEFAULT '',
  practice_modes TEXT NOT NULL DEFAULT '',
  practice_locations TEXT NOT NULL DEFAULT '',
  phone_numbers TEXT NOT NULL DEFAULT '',
  emails TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ANS_RPPS',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_doctors_search_text ON doctors(search_text);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty_search_text ON doctors(specialty_search_text);
CREATE INDEX IF NOT EXISTS idx_doctors_last_first_name ON doctors(last_name, first_name);

CREATE TABLE IF NOT EXISTS patient_doctor_followups (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
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

CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_patient ON patient_doctor_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_doctor ON patient_doctor_followups(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_patient_specialty ON patient_doctor_followups(patient_id, specialty_search_text);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_followups_patient_active ON patient_doctor_followups(patient_id, end_date);

INSERT OR IGNORE INTO doctors (
  id,
  national_id,
  civility,
  first_name,
  last_name,
  profession_code,
  profession_label,
  category_code,
  category_label,
  specialties,
  specialty_codes,
  specialty_search_text,
  practice_modes,
  practice_locations,
  phone_numbers,
  emails,
  search_text,
  source,
  source_updated_at
) VALUES (
  '10000002443',
  '810000002443',
  'Docteur',
  'YVES',
  'NAUDILLON',
  '10',
  'Médecin',
  'C',
  'Civil',
  'Dermatologie et vénéréologie',
  'SM15',
  'dermatologie et venereologie',
  '',
  '',
  '',
  '',
  'yves naudillon dermatologie et venereologie',
  'ANS_RPPS',
  '2026-06-03'
);
