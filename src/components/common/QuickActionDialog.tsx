import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Activity, ClipboardList, Pencil, Search } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type QuickAction = {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  run: () => void
}

export function QuickActionDialog({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: QuickAction[]
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  const filtered = useMemo(
    () =>
      actions.filter((action) =>
        action.label.toLowerCase().includes(query.toLowerCase())
      ),
    [actions, query]
  )
  const activeIndex =
    filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1)

  function reset() {
    setQuery("")
    setActive(0)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset()
    }

    onOpenChange(nextOpen)
  }

  function moveActive(direction: 1 | -1) {
    if (filtered.length === 0) {
      return
    }

    setActive((index) => (index + direction + filtered.length) % filtered.length)
  }

  function run(action: QuickAction) {
    if (action.disabled) {
      return
    }

    action.run()
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(92vw,690px)] max-w-[min(92vw,690px)] gap-0 overflow-hidden rounded-lg border bg-card p-0 text-card-foreground shadow-xl sm:max-w-[690px]"
      >
        <DialogTitle className="sr-only">Actions rapides</DialogTitle>
        <div className="flex h-14 items-center gap-3 border-b bg-muted/35 px-5">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            placeholder="Rechercher une action..."
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              const key = event.key.toLowerCase()

              if (
                (event.ctrlKey || event.metaKey) &&
                (key === "j" || key === "n")
              ) {
                event.preventDefault()
                event.stopPropagation()
                moveActive(1)
              } else if (
                (event.ctrlKey || event.metaKey) &&
                (key === "k" || key === "p")
              ) {
                event.preventDefault()
                event.stopPropagation()
                moveActive(-1)
              } else if (event.key === "ArrowDown") {
                event.preventDefault()
                moveActive(1)
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                moveActive(-1)
              } else if (event.key === "Enter" && filtered[activeIndex]) {
                event.preventDefault()
                run(filtered[activeIndex])
              } else if (event.key === "Escape") {
                handleOpenChange(false)
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="px-2 pt-2 pb-2">
          <div className="max-h-[390px] overflow-y-auto rounded-lg border bg-muted/25 p-2">
            <div className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
              Actions
            </div>
            <ul className="space-y-0.5">
              {filtered.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune action trouvée.
                </li>
              )}
              {filtered.map((action, index) => (
                <li key={action.id}>
                  <button
                    type="button"
                    disabled={action.disabled}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(action)}
                    className={cn(
                      "flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm transition-colors disabled:opacity-40",
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/70"
                    )}
                  >
                    {iconFor(action)}
                    <span className="min-w-0 flex-1 truncate">
                      {action.label}
                    </span>
                    {action.shortcut && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {action.shortcut}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex h-11 items-center gap-4 border-t bg-muted/35 px-5 text-xs text-muted-foreground">
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              Ctrl+J/N
            </kbd>{" "}
            Bas
          </span>
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              Ctrl+K/P
            </kbd>{" "}
            Haut
          </span>
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              Enter
            </kbd>{" "}
            Sélectionner
          </span>
          <span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              Esc
            </kbd>{" "}
            Fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function iconFor(action: QuickAction): ReactNode {
  const className = "size-4 text-muted-foreground"

  switch (action.id) {
    case "create-current-prescription":
    case "add-prescription":
      return <ClipboardList className={className} />
    case "evolution-note":
      return <Activity className={className} />
    case "edit-patient":
      return <Pencil className={className} />
    default:
      return <Search className={className} />
  }
}
