import { callApi } from "@/api/client"
import type {
  AntecedentCategory,
  ClinicalReference,
  ClinicalReferenceKind,
  EntranceExam,
  EntranceExamRecord,
  PatientIdentifier,
} from "@/types"

export type SaveEntranceExamInput = {
  admissionReason?: string | null
  lifestyle?: string | null
  entranceTreatment?: string | null
  diseaseHistory?: string | null
  clinicalExam?: string | null
  allergies?: string | null
  synthesis?: string | null
  antecedents: Array<{
    id?: string
    category: AntecedentCategory
    source?: string | null
    code?: string | null
    label: string
    notes?: string | null
  }>
}

export function getEntranceExam(patientId: PatientIdentifier) {
  return callApi<EntranceExam>(`/patients/${patientId}/entrance-exam`)
}

export function listEntranceExams(
  patientId: PatientIdentifier,
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
  patientId: PatientIdentifier,
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
