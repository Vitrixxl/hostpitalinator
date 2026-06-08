CREATE TABLE accounts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'nurse', 'secretary')),
  service TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  disabled_at TEXT,
  password_hash TEXT NOT NULL DEFAULT ''
);

INSERT INTO accounts_new (
  name,
  email,
  role,
  service,
  status,
  created_at,
  updated_at,
  disabled_at,
  password_hash
)
SELECT
  name,
  email,
  role,
  COALESCE(NULLIF(trim(service), ''), 'Administration'),
  status,
  created_at,
  updated_at,
  disabled_at,
  password_hash
FROM accounts
ORDER BY created_at ASC, email ASC;

DROP TABLE IF EXISTS temp.account_id_map;

CREATE TEMP TABLE account_id_map AS
SELECT accounts.id AS old_id, accounts_new.id AS new_id
FROM accounts
INNER JOIN accounts_new ON accounts_new.email = accounts.email;

DROP TRIGGER IF EXISTS trg_services_delete_unreferenced;

CREATE TABLE sessions_new (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts_new(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

INSERT INTO sessions_new (
  token_hash,
  account_id,
  created_at,
  last_seen_at,
  revoked_at
)
SELECT
  sessions.token_hash,
  account_id_map.new_id,
  sessions.created_at,
  sessions.last_seen_at,
  sessions.revoked_at
FROM sessions
INNER JOIN account_id_map ON account_id_map.old_id = sessions.account_id;

CREATE TABLE audit_logs_new (
  id TEXT PRIMARY KEY,
  actor_account_id INTEGER REFERENCES accounts_new(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata TEXT
);

INSERT INTO audit_logs_new (
  id,
  actor_account_id,
  action,
  entity_type,
  entity_id,
  created_at,
  metadata
)
SELECT
  audit_logs.id,
  account_id_map.new_id,
  audit_logs.action,
  audit_logs.entity_type,
  audit_logs.entity_id,
  audit_logs.created_at,
  audit_logs.metadata
FROM audit_logs
LEFT JOIN account_id_map ON account_id_map.old_id = audit_logs.actor_account_id;

DROP TABLE sessions;
DROP TABLE audit_logs;
DROP TABLE accounts;

ALTER TABLE accounts_new RENAME TO accounts;
ALTER TABLE sessions_new RENAME TO sessions;
ALTER TABLE audit_logs_new RENAME TO audit_logs;

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_service ON accounts(service);
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked_at ON sessions(revoked_at);

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

DROP TABLE IF EXISTS temp.account_id_map;
