import { callApi } from "@/api/client"
import type {
  LabPanel,
  LabPanelResult,
  LabPanelType,
  LabResultStatus,
  LabStatus,
  PatientIdentifier,
} from "@/types"

export type AddLabResultInput = {
  sampledAt: string
  panelType: LabPanelType
  note?: string
  status?: LabStatus
  results: Array<
    Pick<
      LabPanelResult,
      "markerKey" | "markerLabel" | "value" | "unit" | "referenceInterval"
    > & {
      status: LabResultStatus
    }
  >
}

export type UpdateLabResultInput = {
  sampledAt?: string
  results: AddLabResultInput["results"]
}

export function listLabResults(patientId: PatientIdentifier) {
  return callApi<LabPanel[]>(`/patients/${patientId}/lab-results`)
}

export function addLabResult(
  patientId: PatientIdentifier,
  input: AddLabResultInput
) {
  return callApi<LabPanel>(`/patients/${patientId}/lab-results`, {
    method: "POST",
    body: input,
  })
}

export function updateLabResult(
  patientId: PatientIdentifier,
  labPanelId: string,
  input: UpdateLabResultInput
) {
  return callApi<LabPanel>(
    `/patients/${patientId}/lab-results/${labPanelId}`,
    {
      method: "PUT",
      body: input,
    }
  )
}
