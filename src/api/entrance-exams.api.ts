import { callApi } from "@/api/client"
import type {
  AntecedentCategory,
  ClinicalReference,
  ClinicalReferenceKind,
  EntranceExam,
  EntranceExamRecord,
} from "@/types"

export type SaveEntranceExamInput = {
  lifestyle?: string | null
  diseaseHistory?: string | null
  synthesis?: string | null
  antecedents: Array<{
    category: AntecedentCategory
    source?: string | null
    code?: string | null
    label: string
    notes?: string | null
  }>
}

export function getEntranceExam(patientId: string) {
  return callApi<EntranceExam>(`/patients/${patientId}/entrance-exam`)
}

export function listEntranceExams(
  patientId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const params = new URLSearchParams({
    limit: (options.limit ?? 5).toString(),
    offset: (options.offset ?? 0).toString(),
  })

  return callApi<EntranceExamRecord[]>(
    `/patients/${patientId}/entrance-exams?${params.toString()}`
  )
}

export function saveEntranceExam(
  patientId: string,
  input: SaveEntranceExamInput
) {
  return callApi<EntranceExam>(`/patients/${patientId}/entrance-exam`, {
    method: "PUT",
    body: input,
  })
}

export function searchClinicalReferences(
  kind: ClinicalReferenceKind,
  search: string,
  limit = 20
) {
  const params = new URLSearchParams({
    kind,
    search,
    limit: limit.toString(),
  })

  return callApi<ClinicalReference[]>(
    `/clinical-references?${params.toString()}`
  )
}
