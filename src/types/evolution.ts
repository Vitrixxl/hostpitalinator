import type { UserRole } from "@/types/account"

export type EvolutionNote = {
  id: string
  patientId: string
  service: string
  visitId: string
  author: string
  authorRole: UserRole
  recordedAt: string
  content: string
  createdAt: string
}
