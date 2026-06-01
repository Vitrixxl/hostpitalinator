CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  form TEXT NOT NULL DEFAULT '',
  administration_routes TEXT NOT NULL DEFAULT '',
  authorization_status TEXT NOT NULL DEFAULT '',
  authorization_procedure TEXT NOT NULL DEFAULT '',
  marketing_status TEXT NOT NULL DEFAULT '',
  marketing_authorization_date TEXT,
  holder TEXT NOT NULL DEFAULT '',
  enhanced_surveillance TEXT NOT NULL DEFAULT '',
  active_substances TEXT NOT NULL DEFAULT '',
  dosage_summary TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'BDPM',
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_medicines_search_text ON medicines(search_text);
CREATE INDEX IF NOT EXISTS idx_medicines_marketing_status ON medicines(marketing_status);

ALTER TABLE prescriptions ADD COLUMN medicine_id TEXT REFERENCES medicines(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_prescriptions_medicine_id ON prescriptions(medicine_id);

INSERT OR IGNORE INTO medicines (
  id,
  name,
  form,
  administration_routes,
  authorization_status,
  authorization_procedure,
  marketing_status,
  marketing_authorization_date,
  holder,
  enhanced_surveillance,
  active_substances,
  dosage_summary,
  search_text,
  source,
  source_updated_at
) VALUES (
  '60234100',
  'DOLIPRANE 1000 mg, comprimé',
  'comprimé',
  'orale',
  'Autorisation active',
  'Procédure nationale',
  'Commercialisée',
  '09/07/2002',
  'OPELLA HEALTHCARE FRANCE',
  'Non',
  'PARACETAMOL',
  'PARACETAMOL 1000 mg',
  'doliprane 1000 mg comprime comprime orale paracetamol paracetamol 1000 mg',
  'BDPM',
  '2026-06-01'
);
