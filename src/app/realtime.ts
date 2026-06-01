import type { PatientTab } from "./types"

export function realtimePageForPatientTab(tab: PatientTab) {
  return tab === "summary" ? "patient" : tab
}
