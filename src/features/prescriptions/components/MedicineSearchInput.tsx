import { useEffect, useState } from "react"
import { Search } from "lucide-react"

import { searchMedicines } from "@/api"
import { MEDICINE_QUERY_MIN_LENGTH } from "@/app/constants"
import { errorMessage } from "@/app/error-utils"
import { defaultMedicineDosage, defaultMedicineRoute } from "@/app/form-state"
import type { PrescriptionMedicationFormState } from "@/app/types"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import type { Medicine } from "@/types"

export function MedicineSearchInput({
  medication,
  onChange,
}: {
  medication: PrescriptionMedicationFormState
  onChange: (values: Partial<PrescriptionMedicationFormState>) => void
}) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [popoverContainer, setPopoverContainer] =
    useState<HTMLDivElement | null>(null)
  const query = medication.medicationQuery.trim()
  const selected = medication.medicineId !== ""

  useEffect(() => {
    if (selected || query.length < MEDICINE_QUERY_MIN_LENGTH) {
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setSearchError("")

      searchMedicines(query)
        .then((medicines) => {
          if (!cancelled) {
            setResults(medicines)
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setResults([])
            setSearchError(errorMessage(error))
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [query, selected])

  function handleQueryChange(value: string) {
    setResults([])
    setLoading(false)
    setSearchError("")

    const hasSearchLength = value.trim().length >= MEDICINE_QUERY_MIN_LENGTH

    onChange({
      medicineId: "",
      medication: "",
      medicationQuery: value,
      dosage: "",
      route: "",
    })
    setLoading(hasSearchLength)
    setOpen(hasSearchLength)
  }

  function selectMedicine(medicine: Medicine) {
    onChange({
      medicineId: medicine.id,
      medication: medicine.name,
      medicationQuery: medicine.name,
      dosage: defaultMedicineDosage(medicine),
      route: defaultMedicineRoute(medicine),
    })
    setOpen(false)
    setResults([])
    setLoading(false)
    setSearchError("")
  }

  const showResults =
    open && !selected && query.length >= MEDICINE_QUERY_MIN_LENGTH

  return (
    <div ref={setPopoverContainer} className="grid gap-1">
      <Popover open={showResults} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              required
              className="pr-2.5 pl-8"
              value={medication.medicationQuery}
              aria-invalid={!selected && medication.medicationQuery.trim() !== ""}
              onFocus={() => setOpen(true)}
              onChange={(event) => handleQueryChange(event.target.value)}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[min(34rem,calc(100vw-2rem))] p-1"
          container={popoverContainer ?? undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="max-h-72 overflow-auto overscroll-contain">
            {loading && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Recherche...
              </p>
            )}
            {!loading && searchError && (
              <p className="px-3 py-2 text-sm text-destructive">
                {searchError}
              </p>
            )}
            {!loading && !searchError && results.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Aucun médicament trouvé
              </p>
            )}
            {!loading &&
              !searchError &&
              results.map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  className="grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => selectMedicine(medicine)}
                >
                  <span className="font-medium">{medicine.name}</span>
                  <span className="text-xs text-muted-foreground">
                    CIS {medicine.id}
                    {medicine.form ? ` · ${medicine.form}` : ""}
                    {medicine.administrationRoutes
                      ? ` · ${medicine.administrationRoutes}`
                      : ""}
                  </span>
                  {medicine.activeSubstances || medicine.dosageSummary ? (
                    <span className="text-xs text-muted-foreground">
                      {[medicine.activeSubstances, medicine.dosageSummary]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">CIS {medication.medicineId}</Badge>
          <span className="truncate">{medication.medication}</span>
        </div>
      )}
    </div>
  )
}
