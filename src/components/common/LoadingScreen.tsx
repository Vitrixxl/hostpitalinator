import { RefreshCw } from "lucide-react"

export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="flex items-center gap-3 rounded-3xl border bg-card px-4 py-3 text-sm shadow-xs">
        <RefreshCw className="size-4 animate-spin text-primary" />
        {label}
      </div>
    </main>
  )
}
