export type Prescription = {
  id: string
  patientId: string
  medicineId?: string | null
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
