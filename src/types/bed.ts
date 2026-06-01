export type Bed = {
  id: string
  label: string
  service: string
  sortOrder: number
  occupiedPatientId?: string | null
  occupiedPatientName?: string | null
}
