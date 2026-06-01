export type PatientSex = "female" | "male"

export type Patient = {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  sex?: PatientSex | null
  address?: string | null
  apartmentNumber?: string | null
  phoneNumber?: string | null
  email?: string | null
  administrativeInfo?: string | null
  currentService: string
  bedId?: string | null
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}
