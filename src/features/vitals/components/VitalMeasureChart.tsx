import { memo, useCallback, useMemo } from "react"
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  chartDomain,
  formatChartPointValue,
  formatChartTooltipValue,
  panelHasValues,
} from "@/app/chart-utils"
import type { VitalChartPanel } from "@/app/types"
import { EmptyState } from "@/components/common/Feedback"

const CHART_MARGIN = { top: 24, right: 18, bottom: 4, left: -10 } as const
const CHART_DOT_BASE = {
  r: 4,
  fill: "var(--background)",
  strokeWidth: 2,
} as const
const CHART_ACTIVE_DOT = { r: 6 } as const
const LABEL_LIST_MAX_POINTS = 16

export const VitalMeasureChart = memo(function VitalMeasureChart({
  panel,
}: {
  panel: VitalChartPanel
}) {
  const hasValues = useMemo(() => panelHasValues(panel), [panel])
  const maxDecimals = useMemo(
    () => Math.max(...panel.lines.map((line) => line.decimals)),
    [panel.lines]
  )
  const unit = panel.lines.length === 1 ? panel.lines[0].unit : "mmHg"
  const domain = useMemo(() => chartDomain(panel), [panel])
  const showPointLabels = panel.data.length <= LABEL_LIST_MAX_POINTS
  const lineByName = useMemo(
    () => new Map(panel.lines.map((line) => [line.name, line])),
    [panel.lines]
  )
  const formatTick = useCallback(
    (value: number | string) => formatChartPointValue(value, maxDecimals),
    [maxDecimals]
  )
  const formatTooltip = useCallback(
    (value: unknown, name: unknown) => {
      const line = lineByName.get(String(name))

      return [
        formatChartTooltipValue(value, line?.unit ?? "", line?.decimals ?? 0),
        String(name),
      ] as [string, string]
    },
    [lineByName]
  )

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-baseline gap-1.5 text-base font-semibold leading-tight">
            <span className="truncate">{panel.title}</span>
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {unit}
            </span>
          </h3>
        </div>
        <span className="shrink-0 text-right font-mono text-xl font-semibold leading-tight text-foreground">
          {panel.latestValue}
        </span>
      </div>

      <div className="h-52 min-h-52 min-w-0">
        {hasValues ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={panel.data}
              margin={CHART_MARGIN}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={18}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                width={34}
                domain={domain}
                tick={{ fontSize: 10 }}
                tickFormatter={formatTick}
              />
              <RechartsTooltip formatter={formatTooltip} />
              {panel.lines.length > 1 && (
                <Legend
                  height={22}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
              )}
              {panel.lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.stroke}
                  strokeWidth={2}
                  connectNulls
                  dot={{
                    ...CHART_DOT_BASE,
                    stroke: line.stroke,
                  }}
                  activeDot={CHART_ACTIVE_DOT}
                >
                  {showPointLabels && (
                    <LabelList
                      dataKey={line.dataKey}
                      position={line.labelPosition ?? "top"}
                      offset={7}
                      className="fill-foreground text-[9px] font-medium"
                      formatter={(value) =>
                        formatChartPointValue(value, line.decimals)
                      }
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState label={panel.emptyLabel} />
        )}
      </div>
    </div>
  )
})
