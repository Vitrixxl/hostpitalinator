import type { PatientId } from "@/types/patient";

export type AntecedentCategory = "pathology" | "medical_history" | "surgery";

export type PatientAntecedentCategory =
  | AntecedentCategory
  | "medical_act"
  | "heavy_treatment";

export type ClinicalReferenceKind = "pathology" | "medical_act";

export type ClinicalReference = {
  id: string;
  kind: ClinicalReferenceKind;
  source: "CIM-10" | "CCAM";
  code: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type PatientAntecedent = {
  id: string;
  patientId: PatientId;
  category: PatientAntecedentCategory;
  source?: string | null;
  code?: string | null;
  label: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntranceExamRecord = {
  id: string;
  patientId: PatientId;
  visitId: string;
  isDraft: boolean;
  service: string;
  admissionReason?: string | null;
  lifestyle?: string | null;
  entranceTreatment?: string | null;
  diseaseHistory?: string | null;
  clinicalExam?: string | null;
  allergies?: string | null;
  synthesis?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntranceExam = {
  exam?: EntranceExamRecord | null;
  antecedents: PatientAntecedent[];
};
