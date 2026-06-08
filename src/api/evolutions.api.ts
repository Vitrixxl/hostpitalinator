import { callApi } from "@/api/client"
import type { EvolutionNote, PatientIdentifier } from "@/types"

export type AddEvolutionNoteInput = Omit<
  EvolutionNote,
  "id" | "patientId" | "authorRole" | "createdAt"
>

export function listEvolutionNotes(patientId: PatientIdentifier) {
  return callApi<EvolutionNote[]>(`/patients/${patientId}/evolution-notes`)
}

export function addEvolutionNote(
  patientId: PatientIdentifier,
  input: AddEvolutionNoteInput
) {
  return callApi<EvolutionNote>(`/patients/${patientId}/evolution-notes`, {
    method: "POST",
    body: input,
  })
}
