import { callApi } from "@/api/client"
import type { PatientIdentifier, VitalRecord } from "@/types"

export type VitalRecordInput = Omit<
  VitalRecord,
  "id" | "patientId" | "createdAt"
>

export function listVitalRecords(patientId: PatientIdentifier) {
  return callApi<VitalRecord[]>(`/patients/${patientId}/vitals`)
}

export function addVitalRecord(
  patientId: PatientIdentifier,
  input: VitalRecordInput
) {
  return callApi<VitalRecord>(`/patients/${patientId}/vitals`, {
    method: "POST",
    body: input,
  })
}

export function updateVitalRecord(
  patientId: PatientIdentifier,
  recordId: string,
  input: VitalRecordInput
) {
  return callApi<VitalRecord>(`/patients/${patientId}/vitals/${recordId}`, {
    method: "PUT",
    body: input,
  })
}

export function deleteVitalRecord(
  patientId: PatientIdentifier,
  recordId: string
) {
  return callApi<VitalRecord>(`/patients/${patientId}/vitals/${recordId}`, {
    method: "DELETE",
  })
}

export function getLatestVitalRecord(patientId: PatientIdentifier) {
  return callApi<VitalRecord | null>(`/patients/${patientId}/vitals/latest`)
}
