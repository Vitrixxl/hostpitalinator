import { LAB_PANEL_TYPES, labPanelDefinition } from "@/types"
import type { Account, Bed, Medicine, Patient, Service, VitalRecord } from "@/types"

import {
  dateFromIsoValue,
  dateInput,
  dateTimeLocalInput,
  isoDateFromDate,
  nowLocalInput,
  todayInput,
} from "./date-utils"
import type {
  AccountFormState,
  BedFormState,
  DocumentFormState,
  EvolutionFormState,
  LabFormResultState,
  LabFormState,
  PatientFormState,
  PrescriptionDurationUnit,
  PrescriptionFilters,
  PrescriptionFormState,
  PrescriptionMedicationFormState,
  ServiceFormState,
  VitalFormState,
} from "./types"

export function emptyPatientForm(currentService = ""): PatientFormState {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    sex: "",
    address: "",
    apartmentNumber: "",
    phoneNumber: "",
    email: "",
    currentService,
    bedId: "",
    administrativeInfo: "",
  }
}

export function emptyVitalForm(): VitalFormState {
  return {
    recordedAt: nowLocalInput(),
    temperature: "37",
    heartRate: "75",
    systolicBloodPressure: "120",
    diastolicBloodPressure: "75",
    oxygenSaturation: "98",
    weight: "70",
    diuresis: "",
    lastStoolDate: todayInput(),
  }
}

export function vitalRecordToForm(record: VitalRecord): VitalFormState {
  return {
    recordedAt: dateTimeLocalInput(record.recordedAt),
    temperature: record.temperature.toString(),
    heartRate: record.heartRate.toString(),
    systolicBloodPressure: record.systolicBloodPressure.toString(),
    diastolicBloodPressure: record.diastolicBloodPressure.toString(),
    oxygenSaturation: record.oxygenSaturation.toString(),
    weight: record.weight.toString(),
    diuresis: record.diuresis == null ? "" : record.diuresis.toString(),
    lastStoolDate: dateInput(record.lastStoolDate),
  }
}

export function vitalFormToInput(form: VitalFormState) {
  return {
    recordedAt: form.recordedAt,
    temperature: Number(form.temperature),
    heartRate: Number(form.heartRate),
    systolicBloodPressure: Number(form.systolicBloodPressure),
    diastolicBloodPressure: Number(form.diastolicBloodPressure),
    oxygenSaturation: Number(form.oxygenSaturation),
    weight: Number(form.weight),
    diuresis: form.diuresis.trim() === "" ? undefined : Number(form.diuresis),
    lastStoolDate: form.lastStoolDate,
  }
}

export function emptyPrescriptionForm(): PrescriptionFormState {
  return {
    medications: [emptyPrescriptionMedicationForm()],
    startDate: todayInput(),
    status: "active",
  }
}

export function prescriptionEndDateFromDuration(
  startDate: string,
  durationValue: string,
  durationUnit: PrescriptionDurationUnit
) {
  const amount = Number(durationValue)

  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Renseignez une duree valide")
  }

  const start = dateFromIsoValue(startDate)

  if (!start) {
    throw new Error("Renseignez une date de debut valide")
  }

  const end = new Date(start)

  if (durationUnit === "days") {
    end.setDate(end.getDate() + amount)
  } else if (durationUnit === "weeks") {
    end.setDate(end.getDate() + amount * 7)
  } else if (durationUnit === "months") {
    addMonthsClamped(end, amount)
  } else {
    addMonthsClamped(end, amount * 12)
  }

  return isoDateFromDate(end)
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getDate()

  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDayOfTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate()

  date.setDate(Math.min(day, lastDayOfTargetMonth))
}

export function emptyPrescriptionMedicationForm(): PrescriptionMedicationFormState {
  return {
    medicineId: "",
    medication: "",
    medicationQuery: "",
    dosage: "",
    frequency: "",
    route: "",
    durationValue: "",
    durationUnit: "days",
  }
}

export function trimPrescriptionMedicationForm(
  medication: PrescriptionMedicationFormState
): PrescriptionMedicationFormState {
  return {
    medicineId: medication.medicineId.trim(),
    medication: medication.medication.trim(),
    medicationQuery: medication.medicationQuery.trim(),
    dosage: medication.dosage.trim(),
    frequency: medication.frequency.trim(),
    route: medication.route.trim(),
    durationValue: medication.durationValue.trim(),
    durationUnit: medication.durationUnit,
  }
}

export function defaultMedicineRoute(medicine: Medicine) {
  return (
    medicine.administrationRoutes
      .split(";")
      .map((route) => route.trim())
      .find(Boolean) ?? ""
  )
}

export function defaultMedicineDosage(medicine: Medicine) {
  const dosageSummary = medicine.dosageSummary.trim()

  if (dosageSummary) {
    return dosageSummary
  }

  return extractMedicineDosage(medicine.name)
}

function extractMedicineDosage(name: string) {
  return (
    name.match(
      /\b\d+(?:[,.]\d+)?\s*(?:microgrammes?|mg|g|ml|ui|u\.i\.|%)\b/i
    )?.[0] ?? ""
  )
}

export function emptyPrescriptionFilters(): PrescriptionFilters {
  return {
    medication: "",
    startDateFrom: "",
    startDateTo: "",
  }
}

export function emptyLabForm(
  panelType = LAB_PANEL_TYPES[0],
  sampledAt = nowLocalInput()
): LabFormState {
  return {
    sampledAt,
    panelType,
    results: labFormResultDefaults(panelType),
  }
}

function labFormResultDefaults(panelType: LabFormState["panelType"]) {
  return Object.fromEntries(
    labPanelDefinition(panelType).markers.map((marker) => [
      marker.key,
      defaultLabFormResult(),
    ])
  ) as Record<string, LabFormResultState>
}

export function defaultLabFormResult(): LabFormResultState {
  return {
    value: "",
    status: "normal",
  }
}

export function emptyDocumentForm(): DocumentFormState {
  return {
    title: "",
    category: "report",
    storagePath: "",
  }
}

export function emptyEvolutionForm(account: Account): EvolutionFormState {
  return {
    service: account.service,
    visitId: `VIS-${todayInput().replaceAll("-", "")}`,
    recordedAt: nowLocalInput(),
    content: "",
  }
}

export function emptyAccountForm(service = ""): AccountFormState {
  return {
    name: "",
    email: "",
    role: "doctor",
    service,
    invite: false,
  }
}

export function emptyServiceForm(): ServiceFormState {
  return {
    name: "",
  }
}

export function emptyBedForm(service = ""): BedFormState {
  return {
    label: "",
    service,
    sortOrder: "",
  }
}

export function patientToForm(patient: Patient): PatientFormState {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    birthDate: patient.birthDate,
    sex: patient.sex ?? "",
    address: patient.address ?? "",
    apartmentNumber: patient.apartmentNumber ?? "",
    phoneNumber: patient.phoneNumber ?? "",
    email: patient.email ?? "",
    currentService: patient.currentService,
    bedId: patient.bedId ?? "",
    administrativeInfo: patient.administrativeInfo ?? "",
  }
}

export function serviceToForm(service: Service): ServiceFormState {
  return {
    name: service.name,
  }
}

export function bedToForm(bed: Bed): BedFormState {
  return {
    label: bed.label,
    service: bed.service,
    sortOrder: bed.sortOrder.toString(),
  }
}

export function accountToForm(account: Account): AccountFormState {
  return {
    name: account.name,
    email: account.email,
    role: account.role,
    service: account.service,
    invite: account.status === "invited",
  }
}

export function bedFormToInput(form: BedFormState) {
  return {
    label: form.label,
    service: form.service,
    sortOrder: form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder),
  }
}
