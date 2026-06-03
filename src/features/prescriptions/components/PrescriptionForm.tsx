import type { FormEvent } from "react"
import { Plus, Trash2, XCircle } from "lucide-react"

import { PRESCRIPTION_DURATION_UNITS, PRESCRIPTION_STATUSES } from "@/app/constants"
import { emptyPrescriptionMedicationForm } from "@/app/form-state"
import { prescriptionStatusLabel } from "@/app/formatters"
import type {
  PrescriptionDurationUnit,
  PrescriptionFormState,
  PrescriptionMedicationFormState,
} from "@/app/types"
import { DateTextInput } from "@/components/common/DateInputs"
import { Field } from "@/components/common/Field"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { MedicineSearchInput } from "./MedicineSearchInput"

export function PrescriptionForm({
  form,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: PrescriptionFormState
  onChange: (form: PrescriptionFormState) => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  function updateMedication(
    index: number,
    values: Partial<PrescriptionMedicationFormState>
  ) {
    onChange({
      ...form,
      medications: form.medications.map((medication, medicationIndex) =>
        medicationIndex === index ? { ...medication, ...values } : medication
      ),
    })
  }

  function addMedication() {
    onChange({
      ...form,
      medications: [...form.medications, emptyPrescriptionMedicationForm()],
    })
  }

  function removeMedication(index: number) {
    if (form.medications.length === 1) {
      return
    }

    onChange({
      ...form,
      medications: form.medications.filter(
        (_medication, medicationIndex) => medicationIndex !== index
      ),
    })
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Nouvelle prescription</DialogTitle>
        <DialogDescription className="sr-only">
          Ajout d'une prescription medicamenteuse
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Debut" required>
          <DateTextInput
            required
            value={form.startDate}
            onValueChange={(startDate) => onChange({ ...form, startDate })}
          />
        </Field>
        <Field label="Statut" required>
          <Select
            value={form.status}
            onValueChange={(status) => onChange({ ...form, status })}
          >
            <SelectTrigger className="max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESCRIPTION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {prescriptionStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3">
        {form.medications.map((medication, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-3xl border bg-background p-4 shadow md:grid-cols-[minmax(0,1fr)_minmax(7rem,0.35fr)_minmax(9rem,0.45fr)_auto]"
          >
            <Field label="Medicament" required>
              <MedicineSearchInput
                medication={medication}
                onChange={(values) => updateMedication(index, values)}
              />
            </Field>
            <Field label="Duree" required>
              <Input
                required
                min={1}
                step={1}
                type="number"
                value={medication.durationValue}
                onChange={(event) =>
                  updateMedication(index, {
                    durationValue: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="Unite" required>
              <Select
                value={medication.durationUnit}
                onValueChange={(durationUnit) =>
                  updateMedication(index, {
                    durationUnit: durationUnit as PrescriptionDurationUnit,
                  })
                }
              >
                <SelectTrigger className="max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESCRIPTION_DURATION_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                disabled={form.medications.length === 1}
                onClick={() => removeMedication(index)}
                aria-label="Retirer ce medicament"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Button type="button" variant="outline" onClick={addMedication}>
          <Plus className="size-4" />
          Ajouter un medicament
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="size-4" />
          Fermer
        </Button>
        <Button type="submit">
          <Plus className="size-4" />
          Ajouter
        </Button>
      </DialogFooter>
    </form>
  )
}
