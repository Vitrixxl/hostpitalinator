import { labPanelDefinition } from "@/types"
import type { LabPanel, LabResultStatus, LabStatus } from "@/types"

import { LAB_STATUS_LABELS } from "./constants"
import { defaultLabFormResult } from "./form-state"
import type {
  LabFormResultState,
  LabFormState,
  LabMarkerRangeFilter,
} from "./types"

export function labStatusLabel(status: string) {
  return LAB_STATUS_LABELS[status as LabStatus] ?? status
}

export function formatLabPanelPreview(panel: LabPanel) {
  const preview = panel.results
    .slice(0, 3)
    .map((result) =>
      [
        result.markerLabel,
        `${result.value}${result.unit ? ` ${result.unit}` : ""}`,
      ].join(" ")
    )
    .join(" · ")

  if (!preview) {
    return panel.status === "en attente" ? "En attente de resultats" : "-"
  }

  const remainingCount = panel.results.length - 3
  return remainingCount > 0 ? `${preview} · +${remainingCount}` : preview
}

export function labFormResult(form: LabFormState, markerKey: string) {
  return form.results[markerKey] ?? defaultLabFormResult()
}

export function updateLabFormResult(
  form: LabFormState,
  markerKey: string,
  patch: Partial<LabFormResultState>
): LabFormState {
  return {
    ...form,
    results: {
      ...form.results,
      [markerKey]: {
        ...labFormResult(form, markerKey),
        ...patch,
      },
    },
  }
}

export function labFormResultsToInput(form: LabFormState) {
  const definition = labPanelDefinition(form.panelType)

  return definition.markers
    .map((marker) => {
      const result = labFormResult(form, marker.key)

      return {
        markerKey: marker.key,
        markerLabel: marker.label,
        value: result.value.trim(),
        unit: marker.unit,
        referenceInterval: marker.referenceInterval,
        status: result.status,
      }
    })
    .filter((result) => result.value.length > 0)
}

export function worstLabStatus(statuses: LabResultStatus[]): LabStatus {
  if (statuses.length === 0) {
    return "en attente"
  }

  if (statuses.includes("critique")) {
    return "critique"
  }

  if (statuses.includes("alerte")) {
    return "alerte"
  }

  if (statuses.includes("a verifier")) {
    return "a verifier"
  }

  return "normal"
}

export function hasLabMarkerRangeFilter(
  filter: LabMarkerRangeFilter | undefined
): filter is LabMarkerRangeFilter {
  return Boolean(filter?.min.trim() || filter?.max.trim())
}

export function emptyLabMarkerRangeFilter(): LabMarkerRangeFilter {
  return {
    min: "",
    max: "",
  }
}

export function parseOptionalNumberFilter(value: string) {
  const normalizedValue = value.trim().replace(",", ".")

  if (!normalizedValue) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function parseLabNumericValue(value: string) {
  const match = value.trim().replace(",", ".").match(/-?\d+(?:\.\d+)?/)

  if (!match) {
    return null
  }

  const parsedValue = Number(match[0])
  return Number.isFinite(parsedValue) ? parsedValue : null
}
