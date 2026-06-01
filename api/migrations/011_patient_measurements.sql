ALTER TABLE patients ADD COLUMN weight REAL;
ALTER TABLE patients ADD COLUMN height REAL;
ALTER TABLE vital_records ADD COLUMN height REAL;

UPDATE patients
SET weight = (
  SELECT vital_records.weight
  FROM vital_records
  WHERE vital_records.patient_id = patients.id
  ORDER BY vital_records.recorded_at DESC, vital_records.created_at DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM vital_records
  WHERE vital_records.patient_id = patients.id
);
