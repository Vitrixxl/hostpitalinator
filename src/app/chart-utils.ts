import type { VitalChartPanel } from "./types"

export function panelHasValues(panel: VitalChartPanel) {
  return panel.lines.some((line) =>
    panel.data.some((point) => numericChartValue(point[line.dataKey]) !== null)
  )
}

export function chartDomain(panel: VitalChartPanel): [number, number] {
  const values = panel.data.flatMap((point) =>
    panel.lines
      .map((line) => numericChartValue(point[line.dataKey]))
      .filter((value): value is number => value !== null)
  )

  if (values.length === 0) {
    return [0, 1]
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min
  const padding =
    spread > 0 ? spread * 0.24 : Math.max(Math.abs(max) * 0.08, 1)

  return [roundDomainValue(min - padding), roundDomainValue(max + padding)]
}

function roundDomainValue(value: number) {
  return Math.round(value * 10) / 10
}

function numericChartValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function formatChartPointValue(value: unknown, decimals: number) {
  const numericValue = numericChartValue(value)

  if (numericValue === null) {
    return ""
  }

  return numericValue.toFixed(decimals)
}

export function formatChartTooltipValue(
  value: unknown,
  unit: string,
  decimals: number
) {
  const formattedValue = formatChartPointValue(value, decimals)

  if (!formattedValue) {
    return "-"
  }

  return unit ? `${formattedValue} ${unit}` : formattedValue
}
