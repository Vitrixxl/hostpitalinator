import { callApi } from "@/api/client"
import type { Prescription } from "@/types"

export type AddPrescriptionInput = Omit<
  Prescription,
  "id" | "patientId" | "createdAt" | "updatedAt"
>

export function listPrescriptions(patientId: string) {
  return callApi<Prescription[]>(`/patients/${patientId}/prescriptions`)
}

export function addPrescription(
  patientId: string,
  input: AddPrescriptionInput
) {
  return callApi<Prescription>(`/patients/${patientId}/prescriptions`, {
    method: "POST",
    body: input,
  })
}

export function updatePrescriptionStatus(
  prescriptionId: string,
  status: string
) {
  return callApi<Prescription>(`/prescriptions/${prescriptionId}/status`, {
    method: "PATCH",
    body: { status },
  })
}
