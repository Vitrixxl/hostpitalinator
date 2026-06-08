import { callApi } from "@/api/client"
import type { Patient, PatientIdentifier } from "@/types"

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
      | "contactPersons"
      | "currentService"
      | "bedId"
      | "weight"
      | "height"
    >
  >

export type UpdatePatientInput = Partial<CreatePatientInput>

export function listPatients(
  options: {
    includeArchived?: boolean
    ipp?: string
    limit?: number
    q?: string
    service?: string
  } = {}
) {
  const params = new URLSearchParams()

  if (options.includeArchived) {
    params.set("includeArchived", "true")
  }

  if (options.q) {
    params.set("q", options.q)
  }

  if (options.ipp) {
    params.set("ipp", options.ipp)
  }

  if (options.limit !== undefined) {
    params.set("limit", String(options.limit))
  }

  if (options.service) {
    params.set("service", options.service)
  }

  const query = params.toString()
  return callApi<Patient[]>(`/patients${query ? `?${query}` : ""}`)
}

export function getPatient(patientId: PatientIdentifier) {
  return callApi<Patient>(`/patients/${patientId}`)
}

export function createPatient(input: CreatePatientInput) {
  return callApi<Patient>("/patients", {
    method: "POST",
    body: input,
  })
}

export function updatePatient(
  patientId: PatientIdentifier,
  input: UpdatePatientInput
) {
  return callApi<Patient>(`/patients/${patientId}`, {
    method: "PUT",
    body: input,
  })
}

export function startNewPatientVisit(
  patientId: PatientIdentifier,
  input?: Pick<Patient, "bedId">
) {
  return callApi<Patient>(`/patients/${patientId}/new-visit`, {
    method: "PATCH",
    body: input,
  })
}

export function endPatientVisit(patientId: PatientIdentifier) {
  return callApi<Patient>(`/patients/${patientId}/end-visit`, {
    method: "PATCH",
  })
}

export function archivePatient(patientId: PatientIdentifier) {
  return callApi<Patient>(`/patients/${patientId}/archive`, {
    method: "PATCH",
  })
}
