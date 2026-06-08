ALTER TABLE vital_records ADD COLUMN blood_glucose REAL;
ALTER TABLE vital_records ADD COLUMN oxygen_therapy INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vital_records ADD COLUMN oxygen_flow_liters REAL;
