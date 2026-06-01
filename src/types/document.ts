export type MedicalDocumentCategory =
  | "report"
  | "biology"
  | "imaging"
  | "prescription"
  | "letter"
  | "administrative"

export type MedicalDocument = {
  id: string
  patientId: string
  title: string
  category: MedicalDocumentCategory
  createdAt: string
  storagePath?: string | null
  mimeType?: string | null
  originalFileName?: string | null
  fileSizeBytes?: number | null
}
