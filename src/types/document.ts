import type { PatientId } from "@/types/patient"

export type MedicalDocumentCategory =
  | "report"
  | "biology"
  | "imaging"
  | "prescription"
  | "letter"
  | "administrative"

export type MedicalDocument = {
  id: string
  patientId: PatientId
  title: string
  category: MedicalDocumentCategory
  note?: string | null
  createdAt: string
  storagePath?: string | null
  mimeType?: string | null
  originalFileName?: string | null
  fileSizeBytes?: number | null
}
