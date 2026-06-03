import { callApi } from "@/api/client"
import type { EvolutionNote } from "@/types"

export type AddEvolutionNoteInput = Omit<
  EvolutionNote,
  "id" | "patientId" | "authorRole" | "createdAt"
>

export function listEvolutionNotes(patientId: string) {
  return callApi<EvolutionNote[]>(`/patients/${patientId}/evolution-notes`)
}

export function addEvolutionNote(
  patientId: string,
  input: AddEvolutionNoteInput
) {
  return callApi<EvolutionNote>(`/patients/${patientId}/evolution-notes`, {
    method: "POST",
    body: input,
  })
}
