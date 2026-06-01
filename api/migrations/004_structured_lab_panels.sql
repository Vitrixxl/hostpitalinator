CREATE TABLE IF NOT EXISTS lab_panels (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  sampled_at TEXT NOT NULL,
  panel_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS lab_panel_results (
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

INSERT INTO lab_panels (id, patient_id, sampled_at, panel_type, status, created_at)
SELECT
  lower(hex(randomblob(16))),
  patient_id,
  sampled_at,
  panel_type,
  CASE
    WHEN SUM(status = 'critique') > 0 THEN 'critique'
    WHEN SUM(status = 'alerte') > 0 THEN 'alerte'
    WHEN SUM(status = 'a verifier') > 0 THEN 'a verifier'
    ELSE 'normal'
  END,
  MIN(created_at)
FROM lab_results
GROUP BY patient_id, sampled_at, panel_type;

INSERT OR IGNORE INTO lab_panel_results (
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
  lab_results.id,
  lab_panels.id,
  lower(replace(replace(replace(lab_results.marker, ' ', '_'), '-', '_'), '/', '_')),
  lab_results.marker,
  lab_results.value,
  lab_results.unit,
  lab_results.reference_interval,
  lab_results.status,
  0
FROM lab_results
INNER JOIN lab_panels
  ON lab_panels.patient_id = lab_results.patient_id
  AND lab_panels.sampled_at = lab_results.sampled_at
  AND lab_panels.panel_type = lab_results.panel_type;

DROP INDEX IF EXISTS idx_lab_results_patient_sampled;
DROP TABLE IF EXISTS lab_results;

CREATE INDEX IF NOT EXISTS idx_lab_panels_patient_sampled
  ON lab_panels(patient_id, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_panel_results_panel_order
  ON lab_panel_results(lab_panel_id, sort_order ASC);
