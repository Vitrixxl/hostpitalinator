import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      {children}
    </Label>
  )
}
