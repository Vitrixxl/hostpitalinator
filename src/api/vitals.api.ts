import { callApi } from "@/api/client"
import type { VitalRecord } from "@/types"

export type VitalRecordInput = Omit<
  VitalRecord,
  "id" | "patientId" | "createdAt"
>

export function listVitalRecords(patientId: string) {
  return callApi<VitalRecord[]>(`/patients/${patientId}/vitals`)
}

export function addVitalRecord(patientId: string, input: VitalRecordInput) {
  return callApi<VitalRecord>(`/patients/${patientId}/vitals`, {
    method: "POST",
    body: input,
  })
}

export function updateVitalRecord(
  patientId: string,
  recordId: string,
  input: VitalRecordInput
) {
  return callApi<VitalRecord>(`/patients/${patientId}/vitals/${recordId}`, {
    method: "PUT",
    body: input,
  })
}

export function deleteVitalRecord(patientId: string, recordId: string) {
  return callApi<VitalRecord>(`/patients/${patientId}/vitals/${recordId}`, {
    method: "DELETE",
  })
}

export function getLatestVitalRecord(patientId: string) {
  return callApi<VitalRecord | null>(`/patients/${patientId}/vitals/latest`)
}
