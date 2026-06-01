CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  service TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO beds (id, label, service, sort_order) VALUES
  ('bed-med-a01', 'MED-A01', 'Medecine', 101),
  ('bed-med-a02', 'MED-A02', 'Medecine', 102),
  ('bed-med-a03', 'MED-A03', 'Medecine', 103),
  ('bed-med-a04', 'MED-A04', 'Medecine', 104),
  ('bed-card-b01', 'CARD-B01', 'Cardiologie', 201),
  ('bed-card-b02', 'CARD-B02', 'Cardiologie', 202),
  ('bed-card-b03', 'CARD-B03', 'Cardiologie', 203),
  ('bed-surg-c01', 'SURG-C01', 'Chirurgie', 301),
  ('bed-surg-c02', 'SURG-C02', 'Chirurgie', 302),
  ('bed-surg-c03', 'SURG-C03', 'Chirurgie', 303),
  ('bed-urg-d01', 'URG-D01', 'Urgences', 401),
  ('bed-urg-d02', 'URG-D02', 'Urgences', 402);

ALTER TABLE patients ADD COLUMN bed_id TEXT REFERENCES beds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_bed_id ON patients(bed_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_active_bed
  ON patients(bed_id)
  WHERE bed_id IS NOT NULL AND archived_at IS NULL;
