ALTER TABLE patients ADD COLUMN sex TEXT;
ALTER TABLE patients ADD COLUMN address TEXT;
ALTER TABLE patients ADD COLUMN phone_number TEXT;
ALTER TABLE patients ADD COLUMN email TEXT;

CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
