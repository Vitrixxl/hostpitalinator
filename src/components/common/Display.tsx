import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { TableHead } from "@/components/ui/table"

export function MedicalColumnHead({
  label,
  tooltip,
}: {
  label: string
  tooltip: string
}) {
  return (
    <TableHead>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-help underline decoration-dotted underline-offset-4"
            tabIndex={0}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TableHead>
  )
}

export function PatientInfoBadge({ children }: { children: string }) {
  return (
    <Badge
      variant="outline"
      className="h-auto max-w-full justify-start rounded-md bg-background px-2.5 py-1 text-left leading-5 whitespace-normal break-words text-muted-foreground"
    >
      {children}
    </Badge>
  )
}

export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}

export function ClinicalValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-3xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  )
}
