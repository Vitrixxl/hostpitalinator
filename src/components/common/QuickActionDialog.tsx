import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Activity,
  ArrowLeft,
  Building2,
  Check,
  ClipboardList,
  FlaskConical,
  Pencil,
  Search,
} from "lucide-react"
import { motion } from "motion/react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type QuickAction = {
  id: string
  label: string
  detail?: string
  shortcut?: string
  disabled?: boolean
  panelId?: string
  run?: () => void
}

export type QuickActionPanelItem = {
  id: string
  label: string
  value: string
}

export type QuickActionPanel = {
  id: string
  label: string
  placeholder: string
  emptyLabel: string
  queryMode?: "filter" | "input"
  selectedValue?: string
  items: QuickActionPanelItem[]
  onSelect: (item: QuickActionPanelItem, query: string) => void
}

export function QuickActionDialog({
  open,
  onOpenChange,
  actions,
  panels = [],
  surfaceLayoutId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: QuickAction[]
  panels?: QuickActionPanel[]
  surfaceLayoutId?: string
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [activePanelId, setActivePanelId] = useState<string | null>(null)
  const activePanel = panels.find((panel) => panel.id === activePanelId)
  const normalizedQuery = query.toLowerCase()

  const filtered = useMemo(
    () =>
      actions.filter((action) =>
        [action.label, action.detail ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      ),
    [actions, normalizedQuery]
  )
  const filteredPanelItems = useMemo(() => {
    if (!activePanel) {
      return []
    }

    if (activePanel.queryMode === "input") {
      return activePanel.items
    }

    return activePanel.items.filter((item) =>
      item.label.toLowerCase().includes(normalizedQuery)
    )
  }, [activePanel, normalizedQuery])
  const visibleCount = activePanel ? filteredPanelItems.length : filtered.length
  const activeIndex =
    visibleCount === 0 ? 0 : Math.min(active, visibleCount - 1)

  function reset() {
    setQuery("")
    setActive(0)
    setActivePanelId(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset()
    }

    onOpenChange(nextOpen)
  }

  function moveActive(direction: 1 | -1) {
    if (visibleCount === 0) {
      return
    }

    setActive((index) => (index + direction + visibleCount) % visibleCount)
  }

  function run(action: QuickAction) {
    if (action.disabled) {
      return
    }

    if (action.panelId) {
      setActivePanelId(action.panelId)
      setQuery("")
      setActive(0)
      return
    }

    action.run?.()
    handleOpenChange(false)
  }

  function selectPanelItem(item: QuickActionPanelItem) {
    activePanel?.onSelect(item, query)
    handleOpenChange(false)
  }

  function backToActions() {
    setActivePanelId(null)
    setQuery("")
    setActive(0)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(92vw,690px)] max-w-[min(92vw,690px)] gap-0 overflow-visible border-0 bg-transparent p-0 text-card-foreground shadow-none ring-0 data-closed:animate-none data-open:animate-none sm:max-w-[690px]"
      >
        <motion.div
          layoutId={surfaceLayoutId}
          className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xl"
          transition={{ type: "spring", stiffness: 430, damping: 34 }}
        >
          <DialogTitle className="sr-only">Actions rapides</DialogTitle>
          <div className="flex h-14 items-center gap-3 border-b bg-muted/35 px-5">
            {activePanel ? (
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={backToActions}
                aria-label="Retour aux actions"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <Search className="size-5 shrink-0 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={query}
              placeholder={
                activePanel ? activePanel.placeholder : "Rechercher une action..."
              }
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={(event) => {
                const key = event.key.toLowerCase()

                if (
                  event.altKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  (key === "j" || key === "n")
                ) {
                  event.preventDefault()
                  event.stopPropagation()
                  moveActive(1)
                } else if (
                  event.altKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
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
                } else if (
                  event.key === "Enter" &&
                  activePanel &&
                  filteredPanelItems[activeIndex]
                ) {
                  event.preventDefault()
                  selectPanelItem(filteredPanelItems[activeIndex])
                } else if (
                  event.key === "Enter" &&
                  !activePanel &&
                  filtered[activeIndex]
                ) {
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
            <ScrollArea className="max-h-[390px] rounded-lg border bg-muted/25 p-2">
              <div className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
                {activePanel ? activePanel.label : "Actions"}
              </div>
              {activePanel ? (
                <ul className="space-y-0.5">
                  {filteredPanelItems.length === 0 && (
                    <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {activePanel.emptyLabel}
                    </li>
                  )}
                  {filteredPanelItems.map((item, index) => {
                    const selected = item.value === activePanel.selectedValue

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(index)}
                          onClick={() => selectPanelItem(item)}
                          className={cn(
                            "flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm transition-colors",
                            index === activeIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/70"
                          )}
                        >
                          <Check
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground",
                              selected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
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
                          "flex min-h-9 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-40",
                          index === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/70"
                        )}
                      >
                        {iconFor(action)}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{action.label}</span>
                          {action.detail && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {action.detail}
                            </span>
                          )}
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
              )}
            </ScrollArea>
          </div>
          <div className="flex h-11 items-center gap-4 border-t bg-muted/35 px-5 text-xs text-muted-foreground">
            <span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                Alt+J/N
              </kbd>{" "}
              Bas
            </span>
            <span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                Alt+K/P
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
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

function iconFor(action: QuickAction): ReactNode {
  const className = "size-4 text-muted-foreground"

  switch (action.id) {
    case "change-selected-service":
      return <Building2 className={className} />
    case "create-current-prescription":
    case "add-prescription":
      return <ClipboardList className={className} />
    case "request-lab-panel":
      return <FlaskConical className={className} />
    case "evolution-note":
      return <Activity className={className} />
    case "edit-patient":
      return <Pencil className={className} />
    default:
      return <Search className={className} />
  }
}
