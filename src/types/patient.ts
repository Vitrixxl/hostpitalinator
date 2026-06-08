export type PatientSex = "female" | "male"
export type PatientId = number
export type PatientIdentifier = PatientId | string

export type PatientContactPerson = {
  name: string
  relationship: string
  phoneNumber: string
  email: string
}

export type Patient = {
  id: PatientId
  firstName: string
  lastName: string
  birthDate: string
  sex?: PatientSex | null
  address?: string | null
  apartmentNumber?: string | null
  phoneNumber?: string | null
  email?: string | null
  admissionReason?: string | null
  administrativeInfo?: string | null
  contactPersons: PatientContactPerson[]
  currentService: string
  currentVisitId?: string | null
  currentVisitStartedAt?: string | null
  bedId?: string | null
  weight?: number | null
  height?: number | null
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}
