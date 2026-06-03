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

export function VitalMeasureChart({ panel }: { panel: VitalChartPanel }) {
  const hasValues = panelHasValues(panel)
  const maxDecimals = Math.max(...panel.lines.map((line) => line.decimals))
  const unit = panel.lines.length === 1 ? panel.lines[0].unit : "mmHg"

  return (
    <div className="min-w-0 rounded-3xl border bg-background p-4 shadow">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-baseline gap-2 text-xl font-semibold leading-tight">
            <span className="truncate">{panel.title}</span>
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          </h3>
        </div>
        <span className="shrink-0 font-mono text-3xl font-semibold leading-none text-foreground">
          {panel.latestValue}
        </span>
      </div>

      <div className="h-52 min-h-52 min-w-0">
        {hasValues ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={panel.data}
              margin={{ top: 28, right: 18, bottom: 4, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={18}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                width={34}
                domain={chartDomain(panel)}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) =>
                  formatChartPointValue(value, maxDecimals)
                }
              />
              <RechartsTooltip
                formatter={(value, name) => {
                  const line = panel.lines.find(
                    (item) => item.name === String(name)
                  )

                  return [
                    formatChartTooltipValue(
                      value,
                      line?.unit ?? "",
                      line?.decimals ?? 0
                    ),
                    name,
                  ]
                }}
              />
              {panel.lines.length > 1 && <Legend height={24} />}
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
                    r: 4,
                    fill: "var(--background)",
                    stroke: line.stroke,
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey={line.dataKey}
                    position={line.labelPosition ?? "top"}
                    offset={8}
                    className="fill-foreground text-[10px] font-medium"
                    formatter={(value) =>
                      formatChartPointValue(value, line.decimals)
                    }
                  />
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
}
