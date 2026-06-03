CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  service TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(service, label)
);

INSERT OR IGNORE INTO rooms (id, label, service, sort_order)
SELECT
  lower(hex(randomblob(16))),
  room_label,
  service,
  MIN(sort_order)
FROM (
  SELECT
    CASE
      WHEN room IS NULL OR trim(room) = '' THEN label
      ELSE trim(room)
    END AS room_label,
    service,
    sort_order
  FROM beds
)
GROUP BY service, room_label;

ALTER TABLE beds ADD COLUMN room_id TEXT REFERENCES rooms(id) ON DELETE RESTRICT;

UPDATE beds
SET room_id = (
  SELECT rooms.id
  FROM rooms
  WHERE rooms.service = beds.service
    AND rooms.label = CASE
      WHEN beds.room IS NULL OR trim(beds.room) = '' THEN beds.label
      ELSE trim(beds.room)
    END
  LIMIT 1
)
WHERE room_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_service_sort ON rooms(service, sort_order, label);
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON beds(room_id);

CREATE TRIGGER IF NOT EXISTS trg_rooms_service_required_insert
BEFORE INSERT ON rooms
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Room service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_rooms_service_required_update
BEFORE UPDATE OF service ON rooms
FOR EACH ROW
WHEN NEW.service IS NULL OR trim(NEW.service) = ''
BEGIN
  SELECT RAISE(ABORT, 'Room service is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_rooms_service_exists_insert
BEFORE INSERT ON rooms
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Room service must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_rooms_service_exists_update
BEFORE UPDATE OF service ON rooms
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM services WHERE name = NEW.service)
BEGIN
  SELECT RAISE(ABORT, 'Room service must exist');
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

CREATE TRIGGER IF NOT EXISTS trg_rooms_service_sync_beds_update
AFTER UPDATE OF service ON rooms
FOR EACH ROW
BEGIN
  UPDATE beds
  SET service = NEW.service
  WHERE room_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_room_required_insert
BEFORE INSERT ON beds
FOR EACH ROW
WHEN NEW.room_id IS NULL OR trim(NEW.room_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'Bed room is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_room_required_update
BEFORE UPDATE OF room_id ON beds
FOR EACH ROW
WHEN NEW.room_id IS NULL OR trim(NEW.room_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'Bed room is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_room_exists_insert
BEFORE INSERT ON beds
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE id = NEW.room_id)
BEGIN
  SELECT RAISE(ABORT, 'Bed room must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_room_exists_update
BEFORE UPDATE OF room_id ON beds
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE id = NEW.room_id)
BEGIN
  SELECT RAISE(ABORT, 'Bed room must exist');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_room_service_matches_insert
BEFORE INSERT ON beds
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM rooms WHERE id = NEW.room_id AND service = NEW.service
)
BEGIN
  SELECT RAISE(ABORT, 'Bed room service must match bed service');
END;

CREATE TRIGGER IF NOT EXISTS trg_beds_room_service_matches_update
BEFORE UPDATE OF room_id, service ON beds
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM rooms WHERE id = NEW.room_id AND service = NEW.service
)
BEGIN
  SELECT RAISE(ABORT, 'Bed room service must match bed service');
END;

CREATE TRIGGER IF NOT EXISTS trg_services_delete_unreferenced_rooms
BEFORE DELETE ON services
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM rooms WHERE service = OLD.name)
BEGIN
  SELECT RAISE(ABORT, 'Service is still referenced');
END;
