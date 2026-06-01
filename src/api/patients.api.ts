import { callApi } from "@/api/client"
import type { Patient } from "@/types"

export type CreatePatientInput = Pick<
  Patient,
  "firstName" | "lastName" | "birthDate"
> &
  Partial<
    Pick<
      Patient,
      | "sex"
      | "address"
      | "apartmentNumber"
      | "phoneNumber"
      | "email"
      | "administrativeInfo"
      | "currentService"
      | "bedId"
    >
  >

export type UpdatePatientInput = Partial<CreatePatientInput>

export function listPatients(
  options: { includeArchived?: boolean; q?: string } = {}
) {
  const params = new URLSearchParams()

  if (options.includeArchived) {
    params.set("includeArchived", "true")
  }

  if (options.q) {
    params.set("q", options.q)
  }

  const query = params.toString()
  return callApi<Patient[]>(`/patients${query ? `?${query}` : ""}`)
}

export function getPatient(patientId: string) {
  return callApi<Patient>(`/patients/${patientId}`)
}

export function createPatient(input: CreatePatientInput) {
  return callApi<Patient>("/patients", {
    method: "POST",
    body: input,
  })
}

export function updatePatient(patientId: string, input: UpdatePatientInput) {
  return callApi<Patient>(`/patients/${patientId}`, {
    method: "PUT",
    body: input,
  })
}

export function archivePatient(patientId: string) {
  return callApi<Patient>(`/patients/${patientId}/archive`, {
    method: "PATCH",
  })
}
