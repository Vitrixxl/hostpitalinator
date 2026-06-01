export type Patient = {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  administrativeInfo?: string | null
  currentService: string
  bedId?: string | null
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}
