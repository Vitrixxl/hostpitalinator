import type {
  Account,
  AntecedentCategory,
  LabPanelType,
  LabResultStatus,
  PatientSex,
  UserRole,
} from "@/types"

export type PatientTab =
  | "summary"
  | "entrance"
  | "doctors"
  | "vitals"
  | "prescriptions"
  | "labs"
  | "documents"
  | "evolution"

export type PatientFormState = {
  firstName: string
  lastName: string
  birthDate: string
  sex: string
  address: string
  apartmentNumber: string
  phoneNumber: string
  email: string
  admissionReason: string
  currentService: string
  bedId: string
  administrativeInfo: string
  contactPersons: PatientContactPersonFormState[]
}

export type PatientContactPersonFormState = {
  clientId: string
  name: string
  relationship: string
  phoneNumber: string
  email: string
}

export type VitalFormState = {
  recordedAt: string
  temperature: string
  heartRate: string
  systolicBloodPressure: string
  diastolicBloodPressure: string
  oxygenSaturation: string
  bloodGlucose: string
  oxygenTherapy: boolean
  oxygenFlowLiters: string
  weight: string
  diuresis: string
  lastStoolDate: string
}

export type PrescriptionMedicationFormState = {
  clientId: string
  medicineId: string
  medication: string
  medicationQuery: string
  dosage: string
  frequency: string
  route: string
  durationValue: string
  durationUnit: PrescriptionDurationUnit
}

export type PrescriptionFormState = {
  medications: PrescriptionMedicationFormState[]
  startDate: string
  status: string
}

export type PrescriptionDurationUnit = "days" | "weeks" | "months" | "years"

export type PrescriptionFilters = {
  medication: string
  startDateFrom: string
  startDateTo: string
}

export type DoctorFollowupFormState = {
  doctorId: string
  specialty: string
  startDate: string
  endDate: string
}

export type LabFormState = {
  sampledAt: string
  panelType: LabPanelType
  note: string
  results: Record<string, LabFormResultState>
}

export type LabFormResultState = {
  value: string
  status: LabResultStatus
}

export type LabMarkerRangeFilter = {
  min: string
  max: string
}

export type DocumentFormState = {
  title: string
  category: import("@/types").MedicalDocumentCategory
  note: string
  storagePath: string
}

export type EvolutionFormState = {
  service: string
  visitId: string
  recordedAt: string
  content: string
}

export type AntecedentFormState = {
  id: string
  category: AntecedentCategory
  source: string
  code: string
  label: string
  notes: string
  referenceQuery: string
  createdAt: string
}

export type EntranceExamFormState = {
  admissionReason: string
  lifestyle: string
  entranceTreatment: string
  diseaseHistory: string
  clinicalExam: string
  allergies: string
  synthesis: string
  antecedents: AntecedentFormState[]
}

export type AccountFormState = {
  name: string
  email: string
  role: UserRole
  service: string
  invite: boolean
}

export type ServiceFormState = {
  name: string
}

export type RoomFormState = {
  label: string
  service: string
  sortOrder: string
}

export type BedFormState = {
  label: string
  roomId: string
  sortOrder: string
}

export type VitalChartPoint = {
  label: string
  [key: string]: number | string | null
}

export type VitalChartLine = {
  dataKey: string
  name: string
  stroke: string
  unit: string
  decimals: number
  labelPosition?: "top" | "bottom"
}

export type VitalChartPanel = {
  id: string
  title: string
  latestValue: string
  emptyLabel: string
  data: VitalChartPoint[]
  lines: VitalChartLine[]
}

export type { Account, PatientSex }
