import type {
  Account,
  LabPanelType,
  LabStatus,
  PatientSex,
  UserRole,
} from "@/types"

export type PatientTab =
  | "summary"
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
  currentService: string
  bedId: string
  administrativeInfo: string
}

export type VitalFormState = {
  recordedAt: string
  temperature: string
  heartRate: string
  systolicBloodPressure: string
  diastolicBloodPressure: string
  oxygenSaturation: string
  weight: string
  diuresis: string
  lastStoolDate: string
}

export type PrescriptionMedicationFormState = {
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

export type LabFormState = {
  sampledAt: string
  panelType: LabPanelType
  results: Record<string, LabFormResultState>
}

export type LabFormResultState = {
  value: string
  status: LabStatus
}

export type LabMarkerRangeFilter = {
  min: string
  max: string
}

export type DocumentFormState = {
  title: string
  category: import("@/types").MedicalDocumentCategory
  storagePath: string
}

export type EvolutionFormState = {
  service: string
  visitId: string
  recordedAt: string
  content: string
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

export type BedFormState = {
  label: string
  service: string
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
