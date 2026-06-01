export type VitalRecord = {
  id: string
  patientId: string
  recordedAt: string
  temperature: number
  heartRate: number
  systolicBloodPressure: number
  diastolicBloodPressure: number
  oxygenSaturation: number
  weight: number
  height?: number | null
  diuresis?: number | null
  lastStoolDate: string
  createdAt: string
}
