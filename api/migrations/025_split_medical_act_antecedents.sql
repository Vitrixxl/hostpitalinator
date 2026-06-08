PRAGMA legacy_alter_table = ON;

DROP INDEX IF EXISTS idx_patient_antecedents_patient_category;

ALTER TABLE patient_antecedents RENAME TO patient_antecedents_previous;

CREATE TABLE patient_antecedents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('pathology', 'medical_history', 'surgery')),
  source TEXT,
  code TEXT,
  label TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

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
  id,
  patient_id,
  CASE category
    WHEN 'medical_act' THEN 'surgery'
    WHEN 'heavy_treatment' THEN 'medical_history'
    ELSE category
  END,
  CASE WHEN category = 'pathology' THEN source ELSE NULL END,
  CASE WHEN category = 'pathology' THEN code ELSE NULL END,
  label,
  notes,
  created_at,
  updated_at
FROM patient_antecedents_previous;

DROP TABLE patient_antecedents_previous;

CREATE INDEX IF NOT EXISTS idx_patient_antecedents_patient_category
  ON patient_antecedents(patient_id, category, created_at DESC);

PRAGMA legacy_alter_table = OFF;
