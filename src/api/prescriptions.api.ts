import { callApi } from "@/api/client"
import type { PatientIdentifier, Prescription } from "@/types"

export type AddPrescriptionInput = {
  medicineId: string
  dosage: string
  frequency: string
  route: string
  startDate: string
  endDate: string
  status: string
}

export function listPrescriptions(patientId: PatientIdentifier) {
  return callApi<Prescription[]>(`/patients/${patientId}/prescriptions`)
}

export function addPrescription(
  patientId: PatientIdentifier,
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
