import { CheckCircle2, XCircle } from "lucide-react"

import { labStatusLabel } from "@/app/lab-utils"
import { Badge } from "@/components/ui/badge"

export function AlertMessage({
  message,
  tone = "error",
}: {
  message: string
  tone?: "error" | "success"
}) {
  const Icon = tone === "success" ? CheckCircle2 : XCircle

  return (
    <div
      className={`flex items-start gap-2 rounded-3xl border px-3 py-2 text-sm ${
        tone === "success"
          ? "border-primary/20 bg-primary/5 text-foreground"
          : "border-destructive/20 bg-destructive/5 text-destructive"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-3xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function StatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase()
  const displayLabel = labStatusLabel(label)
  const variant =
    normalized.includes("critique") || normalized.includes("alerte")
      ? "destructive"
      : normalized.includes("normal")
        ? "secondary"
        : "outline"

  return <Badge variant={variant}>{displayLabel}</Badge>
}
