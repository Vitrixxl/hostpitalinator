ALTER TABLE evolution_notes
ADD COLUMN author_role TEXT NOT NULL DEFAULT 'doctor'
CHECK (author_role IN ('admin', 'doctor', 'nurse', 'secretary'));
