export type AntecedentCategory = "pathology" | "medical_act";

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
  patientId: string;
  category: AntecedentCategory;
  source?: string | null;
  code?: string | null;
  label: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntranceExamRecord = {
  id: string;
  patientId: string;
  visitId: string;
  isDraft: boolean;
  service: string;
  lifestyle?: string | null;
  diseaseHistory?: string | null;
  synthesis?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntranceExam = {
  exam?: EntranceExamRecord | null;
  antecedents: PatientAntecedent[];
};
