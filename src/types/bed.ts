import type { PatientId, PatientSex } from "@/types/patient"

export type Bed = {
  id: string
  label: string
  roomId: string
  room: string
  service: string
  sortOrder: number
  occupiedPatientId?: PatientId | null
  occupiedPatientName?: string | null
  occupiedPatientSex?: PatientSex | null
}
