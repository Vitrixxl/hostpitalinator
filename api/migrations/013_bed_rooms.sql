ALTER TABLE beds ADD COLUMN room TEXT;

UPDATE beds
SET room = CASE
  WHEN label GLOB '*[0-9][0-9]' THEN substr(label, 1, length(label) - 2)
  ELSE label
END
WHERE room IS NULL OR trim(room) = '';

CREATE INDEX IF NOT EXISTS idx_beds_service_room ON beds(service, room, sort_order);
