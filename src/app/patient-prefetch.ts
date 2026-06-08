import {
  getEntranceExam,
  getPatient,
  listEvolutionNotes,
  listLabResults,
  listMedicalDocuments,
  listPrescriptions,
  listVitalRecords,
} from "@/api"
import type {
  EvolutionNote,
  EntranceExam,
  LabPanel,
  MedicalDocument,
  MedicalDocumentCategory,
  Patient,
  PatientIdentifier,
  Prescription,
  VitalRecord,
} from "@/types"

export type PatientWorkspaceDocumentFilter = MedicalDocumentCategory | "all"

export type PatientWorkspaceSnapshot = {
  patient: Patient
  latestVital: VitalRecord | null
  vitals: VitalRecord[]
  prescriptions: Prescription[]
  labs: LabPanel[]
  documents: MedicalDocument[]
  notes: EvolutionNote[]
  entranceExam: EntranceExam
}

type PatientWorkspaceCacheEntry = {
  data?: PatientWorkspaceSnapshot
  promise?: Promise<PatientWorkspaceSnapshot>
}

type PatientWorkspaceSnapshotOptions = {
  documentFilter?: PatientWorkspaceDocumentFilter
  force?: boolean
}

const patientWorkspaceCache = new Map<string, PatientWorkspaceCacheEntry>()

export function prefetchPatientWorkspace(patientId: PatientIdentifier) {
  void getPatientWorkspaceSnapshot(patientId).catch(() => undefined)
}

export function peekPatientWorkspaceSnapshot(
  patientId: PatientIdentifier,
  documentFilter: PatientWorkspaceDocumentFilter = "all"
) {
  return patientWorkspaceCache.get(cacheKey(patientId, documentFilter))?.data
}

export async function getPatientWorkspaceSnapshot(
  patientId: PatientIdentifier,
  options: PatientWorkspaceSnapshotOptions = {}
) {
  const documentFilter = options.documentFilter ?? "all"
  const key = cacheKey(patientId, documentFilter)
  const current = patientWorkspaceCache.get(key)

  if (!options.force) {
    if (current?.data) {
      return current.data
    }

    if (current?.promise) {
      return current.promise
    }
  } else if (current?.promise) {
    return current.promise
  }

  const promise = fetchPatientWorkspaceSnapshot(patientId, documentFilter)
  patientWorkspaceCache.set(key, {
    data: current?.data,
    promise,
  })

  try {
    const data = await promise
    patientWorkspaceCache.set(key, { data })
    return data
  } catch (error) {
    if (current?.data) {
      patientWorkspaceCache.set(key, { data: current.data })
    } else {
      patientWorkspaceCache.delete(key)
    }

    throw error
  }
}

export function invalidatePatientWorkspaceSnapshot(patientId: PatientIdentifier) {
  for (const key of patientWorkspaceCache.keys()) {
    if (key.startsWith(`${patientId}:`)) {
      patientWorkspaceCache.delete(key)
    }
  }
}

async function fetchPatientWorkspaceSnapshot(
  patientId: PatientIdentifier,
  documentFilter: PatientWorkspaceDocumentFilter
): Promise<PatientWorkspaceSnapshot> {
  const [
    patient,
    vitals,
    prescriptions,
    labs,
    documents,
    notes,
    entranceExam,
  ] = await Promise.all([
    getPatient(patientId),
    listVitalRecords(patientId),
    listPrescriptions(patientId),
    listLabResults(patientId),
    listMedicalDocuments(
      patientId,
      documentFilter === "all" ? {} : { category: documentFilter }
    ),
    listEvolutionNotes(patientId),
    getEntranceExam(patientId),
  ])

  return {
    patient,
    latestVital: vitals[0] ?? null,
    vitals,
    prescriptions,
    labs,
    documents,
    notes,
    entranceExam,
  }
}

function cacheKey(
  patientId: PatientIdentifier,
  documentFilter: PatientWorkspaceDocumentFilter
) {
  return `${patientId}:${documentFilter}`
}
