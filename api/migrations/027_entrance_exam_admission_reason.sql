ALTER TABLE entrance_exams ADD COLUMN admission_reason TEXT;

UPDATE entrance_exams
SET admission_reason = (
  SELECT patients.admission_reason
  FROM patients
  WHERE patients.id = entrance_exams.patient_id
)
WHERE admission_reason IS NULL
  AND visit_id = (
    SELECT patients.current_visit_id
    FROM patients
    WHERE patients.id = entrance_exams.patient_id
  );
