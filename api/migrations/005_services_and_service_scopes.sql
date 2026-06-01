CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO services (id, name) VALUES
  ('svc-administration', 'Administration'),
  ('svc-medecine', 'Medecine'),
  ('svc-cardiologie', 'Cardiologie'),
  ('svc-chirurgie', 'Chirurgie'),
  ('svc-urgences', 'Urgences');

INSERT OR IGNORE INTO services (id, name)
SELECT lower(hex(randomblob(16))), service_name
FROM (
  SELECT trim(service) AS service_name FROM accounts WHERE service IS NOT NULL AND trim(service) <> ''
  UNION
  SELECT trim(current_service) AS service_name FROM patients WHERE current_service IS NOT NULL AND trim(current_service) <> ''
  UNION
  SELECT trim(service) AS service_name FROM beds WHERE service IS NOT NULL AND trim(service) <> ''
  UNION
  SELECT trim(service) AS service_name FROM evolution_notes WHERE trim(service) <> ''
)
WHERE service_name <> '';

UPDATE accounts
SET service = 'Administration'
WHERE service IS NULL OR trim(service) = '';

UPDATE patients
SET current_service = 'Administration'
WHERE current_service IS NULL OR trim(current_service) = '';

UPDATE beds
SET service = 'Administration'
WHERE service IS NULL OR trim(service) = '';

UPDATE evolution_notes
SET service = 'Administration'
WHERE trim(service) = '';

CREATE INDEX IF NOT EXISTS idx_accounts_service ON accounts(service);
CREATE INDEX IF NOT EXISTS idx_patients_current_service ON patients(current_service);
CREATE INDEX IF NOT EXISTS idx_beds_service ON beds(service);
CREATE INDEX IF NOT EXISTS idx_evolution_notes_service ON evolution_notes(service);

CREATE TRIGGER IF NOT EXISTS trg_accounts_service_required_insert
BEFORE INSERT ON accounts
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Account service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_service_required_update
BEFORE UPDATE OF service ON accounts
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Account service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_service_exists_insert
BEFORE INSERT ON accounts
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Account service must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_service_exists_update
BEFORE UPDATE OF service ON accounts
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Account service must exist');
END;

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

CREATE TRIGGER IF NOT EXISTS trg_beds_service_required_insert
BEFORE INSERT ON beds
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Bed service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_service_required_update
BEFORE UPDATE OF service ON beds
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Bed service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_service_exists_insert
BEFORE INSERT ON beds
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Bed service must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_service_exists_update
BEFORE UPDATE OF service ON beds
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Bed service must exist');
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
