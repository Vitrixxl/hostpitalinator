export type Prescription = {
  id: string
  patientId: string
  medication: string
  dosage: string
  frequency: string
  route: string
  startDate: string
  endDate?: string | null
  prescriber: string
  status: string
  createdAt: string
  updatedAt: string
}
