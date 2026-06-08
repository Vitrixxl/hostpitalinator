import type { PatientId } from "@/types/patient"

export type Doctor = {
  id: string
  nationalId: string
  civility: string
  firstName: string
  lastName: string
  professionCode: string
  professionLabel: string
  categoryCode: string
  categoryLabel: string
  specialties: string
  specialtyCodes: string
  practiceModes: string
  practiceLocations: string
  phoneNumbers: string
  emails: string
  source: string
  sourceUpdatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type PatientDoctorFollowup = {
  id: string
  patientId: PatientId
  doctorId: string
  doctorNationalId: string
  doctorCivility: string
  doctorFirstName: string
  doctorLastName: string
  doctorProfessionLabel: string
  doctorSpecialties: string
  doctorPracticeLocations: string
  doctorPhoneNumbers: string
  doctorEmails: string
  specialty: string
  startDate: string
  endDate?: string | null
  createdAt: string
  updatedAt: string
}
