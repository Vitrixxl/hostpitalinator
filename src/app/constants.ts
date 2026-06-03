import {
  Activity,
  ClipboardList,
  ClipboardPenLine,
  FileText,
  FlaskConical,
  HeartPulse,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { LAB_STATUSES } from "@/types";
import type {
  Account,
  LabStatus,
  MedicalDocumentCategory,
  PatientSex,
  UserRole,
} from "@/types";

import type { PatientTab, PrescriptionDurationUnit } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  doctor: "Medecin",
  nurse: "Infirmier",
  secretary: "Secretaire",
};

export const ACCOUNT_STATUS_LABELS: Record<Account["status"], string> = {
  active: "Actif",
  invited: "Invite",
  disabled: "Suspendu",
};

export const DOCUMENT_CATEGORY_LABELS: Record<MedicalDocumentCategory, string> =
  {
    report: "Compte rendu",
    biology: "Biologie",
    imaging: "Imagerie",
    prescription: "Prescription",
    letter: "Courrier",
    administrative: "Administratif",
  };

export const DOCUMENT_CATEGORIES = Object.keys(
  DOCUMENT_CATEGORY_LABELS,
) as MedicalDocumentCategory[];

export const PATIENT_SEX_LABELS: Record<PatientSex, string> = {
  female: "Femme",
  male: "Homme",
};

export const PATIENT_SEXES = Object.keys(PATIENT_SEX_LABELS) as PatientSex[];

export const LAB_STATUS_LABELS: Record<LabStatus, string> = {
  normal: "Normal",
  alerte: "Alerte",
  critique: "Critique",
  "a verifier": "A verifier",
};

export const PATIENT_TABS: Array<{
  value: PatientTab;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "summary", label: "Synthese", icon: Stethoscope },
  { value: "entrance", label: "Examen entree", icon: ClipboardPenLine },
  { value: "vitals", label: "Constantes", icon: HeartPulse },
  { value: "prescriptions", label: "Prescriptions", icon: ClipboardList },
  { value: "labs", label: "Biologie", icon: FlaskConical },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "evolution", label: "Evolution", icon: Activity },
];

export const PATIENT_TAB_VALUES = PATIENT_TABS.map((tab) => tab.value);

export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "En pause",
  completed: "Terminee",
  stopped: "Arretee",
};

export const PRESCRIPTION_STATUSES = Object.keys(PRESCRIPTION_STATUS_LABELS);

export const PRESCRIPTION_DURATION_UNITS: Array<{
  value: PrescriptionDurationUnit;
  label: string;
}> = [
  { value: "days", label: "Jours" },
  { value: "weeks", label: "Semaines" },
  { value: "months", label: "Mois" },
  { value: "years", label: "Annees" },
];

export const UNASSIGNED_BED_VALUE = "__unassigned__";
export const UNSELECTED_SERVICE_VALUE = "__service_unselected__";
export const ADDRESS_QUERY_MIN_LENGTH = 3;
export const MEDICINE_QUERY_MIN_LENGTH = 2;

export { LAB_STATUSES };
