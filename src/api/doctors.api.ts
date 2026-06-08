import { callApi } from "@/api/client"
import type { Doctor, PatientDoctorFollowup, PatientIdentifier } from "@/types"

export type SavePatientDoctorFollowupInput = {
  doctorId: string
  specialty: string
  startDate: string
  endDate?: string | null
}

export function searchDoctors(
  search: string,
  options: { specialty?: string; limit?: number } = {},
) {
  const params = new URLSearchParams()

  if (search) {
    params.set("search", search)
  }

  if (options.specialty) {
    params.set("specialty", options.specialty)
  }

  params.set("limit", (options.limit ?? 20).toString())

  return callApi<Doctor[]>(`/doctors?${params.toString()}`)
}

export function listPatientDoctorFollowups(
  patientId: PatientIdentifier,
  options: { specialty?: string } = {},
) {
  const params = new URLSearchParams()

  if (options.specialty) {
    params.set("specialty", options.specialty)
  }

  const query = params.toString()

  return callApi<PatientDoctorFollowup[]>(
    `/patients/${patientId}/doctors${query ? `?${query}` : ""}`,
  )
}

export function addPatientDoctorFollowup(
  patientId: PatientIdentifier,
  input: SavePatientDoctorFollowupInput,
) {
  return callApi<PatientDoctorFollowup>(`/patients/${patientId}/doctors`, {
    method: "POST",
    body: input,
  })
}

export function updatePatientDoctorFollowup(
  patientId: PatientIdentifier,
  followupId: string,
  input: SavePatientDoctorFollowupInput,
) {
  return callApi<PatientDoctorFollowup>(
    `/patients/${patientId}/doctors/${followupId}`,
    {
      method: "PUT",
      body: input,
    },
  )
}

export function deletePatientDoctorFollowup(
  patientId: PatientIdentifier,
  followupId: string,
) {
  return callApi<PatientDoctorFollowup>(
    `/patients/${patientId}/doctors/${followupId}`,
    {
      method: "DELETE",
    },
  )
}
