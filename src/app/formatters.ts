import type { Bed, PatientSex } from "@/types"

import { PATIENT_SEX_LABELS, PRESCRIPTION_STATUS_LABELS } from "./constants"
import { richTextToPlainText } from "./rich-text"

export function patientSexLabel(sex?: PatientSex | null) {
  return sex ? PATIENT_SEX_LABELS[sex] ?? sex : "Non renseigné"
}

export function prescriptionStatusLabel(status: string) {
  return PRESCRIPTION_STATUS_LABELS[status] ?? "Statut inconnu"
}

export function optionalValue(value: string) {
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

export function nullableOptionalValue(value: string) {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export function textIncludes(value: string, filter: string) {
  const normalizedFilter = filter.trim().toLocaleLowerCase()

  if (!normalizedFilter) {
    return true
  }

  return richTextToPlainText(value)
    .toLocaleLowerCase()
    .includes(normalizedFilter)
}

export function bedLabel(beds: Bed[], bedId?: string | null) {
  if (!bedId) {
    return "Non assigné"
  }

  return bedLabelText(beds.find((bed) => bed.id === bedId) ?? bedId)
}

export function bedLabelText(bed: Bed | string) {
  if (typeof bed === "string") {
    return bed
  }

  const roomLabel = bed.room ? `Chambre ${bed.room}` : "Chambre non renseignée"
  const label = `${roomLabel}, lit ${bed.label}`

  return bed.service ? `${label} - ${bed.service}` : label
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} o`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
