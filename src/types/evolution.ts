import type { UserRole } from "@/types/account"
import type { PatientId } from "@/types/patient"

export type EvolutionNote = {
  id: string
  patientId: PatientId
  service: string
  visitId: string
  author: string
  authorRole: UserRole
  recordedAt: string
  content: string
  createdAt: string
}
