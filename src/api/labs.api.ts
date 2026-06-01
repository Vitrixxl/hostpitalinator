import { callApi } from "@/api/client"
import type { LabPanel, LabPanelResult, LabPanelType, LabStatus } from "@/types"

export type AddLabResultInput = {
  sampledAt: string
  panelType: LabPanelType
  status?: LabStatus
  results: Array<
    Pick<
      LabPanelResult,
      "markerKey" | "markerLabel" | "value" | "unit" | "referenceInterval"
    > & {
      status: LabStatus
    }
  >
}

export function listLabResults(patientId: string) {
  return callApi<LabPanel[]>(`/patients/${patientId}/lab-results`)
}

export function addLabResult(patientId: string, input: AddLabResultInput) {
  return callApi<LabPanel>(`/patients/${patientId}/lab-results`, {
    method: "POST",
    body: input,
  })
}
