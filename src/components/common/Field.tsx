import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"

export function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <Label className="grid gap-1.5">
      <span className="flex items-center gap-1">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-xs text-destructive">
              *
            </span>
            <span className="sr-only">obligatoire</span>
          </>
        )}
      </span>
      {children}
      {error && (
        <span className="text-xs font-normal text-destructive" role="alert">
          {error}
        </span>
      )}
    </Label>
  )
}
