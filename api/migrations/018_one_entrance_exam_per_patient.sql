DELETE FROM entrance_exams
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY patient_id
        ORDER BY updated_at DESC, created_at DESC
      ) AS duplicate_rank
    FROM entrance_exams
  )
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entrance_exams_one_per_patient
  ON entrance_exams(patient_id);
