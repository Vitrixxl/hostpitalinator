import type { PatientId } from "@/types/patient"

export type VitalRecord = {
  id: string
  patientId: PatientId
  recordedAt: string
  temperature: number
  heartRate: number
  systolicBloodPressure: number
  diastolicBloodPressure: number
  oxygenSaturation: number
  bloodGlucose?: number | null
  oxygenTherapy: boolean
  oxygenFlowLiters?: number | null
  weight: number
  height?: number | null
  diuresis?: number | null
  lastStoolDate: string
  createdAt: string
}
