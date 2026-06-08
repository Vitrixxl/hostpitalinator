import { LAB_PANEL_TYPES, labPanelDefinition } from "@/types"
import type {
  Account,
  AntecedentCategory,
  Bed,
  EntranceExam,
  Medicine,
  Patient,
  PatientAntecedent,
  Room,
  Service,
  VitalRecord,
} from "@/types"

import {
  dateFromIsoValue,
  dateInput,
  dateTimeLocalInput,
  isoDateFromDate,
  nowLocalInput,
  todayInput,
} from "./date-utils"
import {
  normalizeRichText,
  richTextHasText,
  richTextNullableOptionalValue,
} from "./rich-text"
import type {
  AccountFormState,
  AntecedentFormState,
  BedFormState,
  DoctorFollowupFormState,
  DocumentFormState,
  EvolutionFormState,
  EntranceExamFormState,
  LabFormResultState,
  LabFormState,
  PatientContactPersonFormState,
  PatientFormState,
  PrescriptionDurationUnit,
  PrescriptionFilters,
  PrescriptionFormState,
  PrescriptionMedicationFormState,
  RoomFormState,
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
    admissionReason: "",
    currentService,
    bedId: "",
    administrativeInfo: "",
    contactPersons: [emptyPatientContactPersonForm()],
  }
}

export function emptyPatientContactPersonForm(): PatientContactPersonFormState {
  return {
    clientId: createFormClientId(),
    name: "",
    relationship: "",
    phoneNumber: "",
    email: "",
  }
}

export function emptyVitalForm(): VitalFormState {
  return {
    recordedAt: "",
    temperature: "",
    heartRate: "",
    systolicBloodPressure: "",
    diastolicBloodPressure: "",
    oxygenSaturation: "",
    bloodGlucose: "",
    oxygenTherapy: false,
    oxygenFlowLiters: "",
    weight: "",
    diuresis: "",
    lastStoolDate: "",
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
    bloodGlucose:
      record.bloodGlucose == null ? "" : record.bloodGlucose.toString(),
    oxygenTherapy: record.oxygenTherapy,
    oxygenFlowLiters:
      record.oxygenFlowLiters == null ? "" : record.oxygenFlowLiters.toString(),
    weight: record.weight.toString(),
    diuresis: record.diuresis == null ? "" : record.diuresis.toString(),
    lastStoolDate: dateInput(record.lastStoolDate),
  }
}

export function vitalFormToInput(
  form: VitalFormState,
  recordedAt = form.recordedAt
) {
  return {
    recordedAt,
    temperature: Number(form.temperature),
    heartRate: Number(form.heartRate),
    systolicBloodPressure: Number(form.systolicBloodPressure),
    diastolicBloodPressure: Number(form.diastolicBloodPressure),
    oxygenSaturation: Number(form.oxygenSaturation),
    bloodGlucose:
      form.bloodGlucose.trim() === "" ? undefined : Number(form.bloodGlucose),
    oxygenTherapy: form.oxygenTherapy,
    oxygenFlowLiters:
      form.oxygenTherapy && form.oxygenFlowLiters.trim() !== ""
        ? Number(form.oxygenFlowLiters)
        : undefined,
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
    clientId: createFormClientId(),
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
    clientId: medication.clientId,
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

function createFormClientId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  )
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

export function emptyDoctorFollowupForm(): DoctorFollowupFormState {
  return {
    doctorId: "",
    specialty: "",
    startDate: todayInput(),
    endDate: "",
  }
}

export function emptyLabForm(
  panelType = LAB_PANEL_TYPES[0],
  sampledAt = nowLocalInput(),
  note = ""
): LabFormState {
  return {
    sampledAt,
    panelType,
    note,
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
    note: "",
    storagePath: "",
  }
}

export function emptyEvolutionForm(
  account: Account,
  visitId = defaultVisitId()
): EvolutionFormState {
  return {
    service: account.service,
    visitId,
    recordedAt: nowLocalInput(),
    content: "",
  }
}

export function emptyEntranceExamForm(): EntranceExamFormState {
  return {
    admissionReason: "",
    lifestyle: "",
    entranceTreatment: "",
    diseaseHistory: "",
    clinicalExam: "",
    allergies: "",
    synthesis: "",
    antecedents: [],
  }
}

export function emptyAntecedentForm(
  category: AntecedentCategory
): AntecedentFormState {
  return {
    id: crypto.randomUUID(),
    category,
    source: "",
    code: "",
    label: "",
    notes: "",
    referenceQuery: "",
    createdAt: "",
  }
}

export function entranceExamToForm(exam: EntranceExam): EntranceExamFormState {
  return {
    admissionReason: exam.exam?.admissionReason ?? "",
    lifestyle: exam.exam?.lifestyle ?? "",
    entranceTreatment: exam.exam?.entranceTreatment ?? "",
    diseaseHistory: exam.exam?.diseaseHistory ?? "",
    clinicalExam: exam.exam?.clinicalExam ?? "",
    allergies: exam.exam?.allergies ?? "",
    synthesis: exam.exam?.synthesis ?? "",
    antecedents: exam.antecedents.map(antecedentToForm),
  }
}

function antecedentToForm(antecedent: PatientAntecedent): AntecedentFormState {
  const referenceQuery = [antecedent.code, antecedent.label]
    .filter(Boolean)
    .join(" - ")

  return {
    id: antecedent.id,
    category: normalizeAntecedentCategory(antecedent.category),
    source: antecedent.source ?? "",
    code: antecedent.code ?? "",
    label: antecedent.label,
    notes: antecedent.notes ?? "",
    referenceQuery,
    createdAt: antecedent.createdAt,
  }
}

export function entranceExamFormToInput(form: EntranceExamFormState) {
  return {
    admissionReason: richTextNullableOptionalValue(form.admissionReason),
    lifestyle: richTextNullableOptionalValue(form.lifestyle),
    entranceTreatment: richTextNullableOptionalValue(form.entranceTreatment),
    diseaseHistory: richTextNullableOptionalValue(form.diseaseHistory),
    clinicalExam: richTextNullableOptionalValue(form.clinicalExam),
    allergies: richTextNullableOptionalValue(form.allergies),
    synthesis: richTextNullableOptionalValue(form.synthesis),
    antecedents: form.antecedents
      .map((antecedent) => ({
        id: antecedent.createdAt ? antecedent.id : undefined,
        category: antecedent.category,
        source:
          antecedent.category === "pathology"
            ? antecedent.source.trim() || null
            : null,
        code:
          antecedent.category === "pathology"
            ? antecedent.code.trim() || null
            : null,
        label:
          antecedent.category === "pathology"
            ? antecedent.label.trim()
            : normalizeRichText(antecedent.label),
        notes: richTextNullableOptionalValue(antecedent.notes),
      }))
      .filter((antecedent) => richTextHasText(antecedent.label)),
  }
}

function normalizeAntecedentCategory(
  category: PatientAntecedent["category"]
): AntecedentCategory {
  if (category === "medical_act") {
    return "surgery"
  }

  if (category === "heavy_treatment") {
    return "medical_history"
  }

  return category
}

export function defaultVisitId() {
  return `VIS-${todayInput().replaceAll("-", "")}`
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

export function emptyRoomForm(service = ""): RoomFormState {
  return {
    label: "",
    service,
    sortOrder: "",
  }
}

export function emptyBedForm(roomId = ""): BedFormState {
  return {
    label: "",
    roomId,
    sortOrder: "",
  }
}

export function patientToForm(patient: Patient): PatientFormState {
  const contactPersons = patient.contactPersons ?? []

  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    birthDate: patient.birthDate,
    sex: patient.sex ?? "",
    address: patient.address ?? "",
    apartmentNumber: patient.apartmentNumber ?? "",
    phoneNumber: patient.phoneNumber ?? "",
    email: patient.email ?? "",
    admissionReason: patient.admissionReason ?? "",
    currentService: patient.currentService,
    bedId: patient.bedId ?? "",
    administrativeInfo: patient.administrativeInfo ?? "",
    contactPersons: contactPersons.length
      ? contactPersons.map((contactPerson) => ({
          clientId: createFormClientId(),
          name: contactPerson.name,
          relationship: contactPerson.relationship,
          phoneNumber: contactPerson.phoneNumber,
          email: contactPerson.email,
        }))
      : [emptyPatientContactPersonForm()],
  }
}

export function patientContactPersonsFormToInput(
  contactPersons: PatientContactPersonFormState[]
) {
  return contactPersons
    .map((contactPerson) => ({
      name: contactPerson.name.trim(),
      relationship: contactPerson.relationship.trim(),
      phoneNumber: contactPerson.phoneNumber.trim(),
      email: contactPerson.email.trim(),
    }))
    .filter((contactPerson) =>
      Object.values(contactPerson).some((value) => value !== "")
    )
}

export function serviceToForm(service: Service): ServiceFormState {
  return {
    name: service.name,
  }
}

export function roomToForm(room: Room): RoomFormState {
  return {
    label: room.label,
    service: room.service,
    sortOrder: room.sortOrder.toString(),
  }
}

export function bedToForm(bed: Bed): BedFormState {
  return {
    label: bed.label,
    roomId: bed.roomId,
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
    roomId: form.roomId,
    sortOrder: form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder),
  }
}

export function roomFormToInput(form: RoomFormState) {
  return {
    label: form.label,
    service: form.service,
    sortOrder: form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder),
  }
}
