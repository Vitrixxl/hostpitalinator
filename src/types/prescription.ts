import type { PatientId } from "@/types/patient"

export type Prescription = {
  id: string
  patientId: PatientId
  medicineId?: string | null
  medication: string
  dosage: string
  frequency: string
  route: string
  startDate: string
  endDate?: string | null
  prescriber: string
  status: string
  createdAt: string
  updatedAt: string
}
