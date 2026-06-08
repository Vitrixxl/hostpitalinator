import type { Dispatch, FormEvent, SetStateAction } from "react"
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
  onChange: Dispatch<SetStateAction<PrescriptionFormState>>
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  function updateMedication(
    index: number,
    values: Partial<PrescriptionMedicationFormState>
  ) {
    onChange((current) => {
      return {
        ...current,
        medications: current.medications.map((medication, medicationIndex) =>
          medicationIndex === index ? { ...medication, ...values } : medication
        ),
      }
    })
  }

  function addMedication() {
    onChange((current) => {
      return {
        ...current,
        medications: [...current.medications, emptyPrescriptionMedicationForm()],
      }
    })
  }

  function removeMedication(index: number) {
    onChange((current) => {
      if (current.medications.length === 1) {
        return current
      }

      return {
        ...current,
        medications: current.medications.filter(
          (_medication, medicationIndex) => medicationIndex !== index
        ),
      }
    })
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Nouvelle prescription</DialogTitle>
        <DialogDescription className="sr-only">
          Ajout d'une prescription médicamenteuse
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Début" required>
          <DateTextInput
            required
            value={form.startDate}
            onValueChange={(startDate) =>
              onChange((current) => ({ ...current, startDate }))
            }
          />
        </Field>
        <Field label="Statut" required>
          <Select
            value={form.status}
            onValueChange={(status) =>
              onChange((current) => ({ ...current, status }))
            }
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
          <PrescriptionMedicationRow
            key={medication.clientId}
            canRemove={form.medications.length > 1}
            index={index}
            medication={medication}
            onChange={updateMedication}
            onRemove={removeMedication}
          />
        ))}
      </div>

      <div>
        <Button type="button" variant="outline" onClick={addMedication}>
          <Plus className="size-4" />
          Ajouter un médicament
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

function PrescriptionMedicationRow({
  canRemove,
  index,
  medication,
  onChange,
  onRemove,
}: {
  canRemove: boolean
  index: number
  medication: PrescriptionMedicationFormState
  onChange: (
    index: number,
    values: Partial<PrescriptionMedicationFormState>
  ) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[minmax(0,1fr)_minmax(7rem,0.35fr)_minmax(9rem,0.45fr)_auto]">
      <Field label="Médicament" required>
        <MedicineSearchInput
          medication={medication}
          onChange={(values) => onChange(index, values)}
        />
      </Field>
      <Field label="Durée" required>
        <Input
          required
          min={1}
          step={1}
          type="number"
          value={medication.durationValue}
          onChange={(event) =>
            onChange(index, {
              durationValue: event.target.value,
            })
          }
        />
      </Field>
      <Field label="Unité" required>
        <Select
          value={medication.durationUnit}
          onValueChange={(durationUnit) =>
            onChange(index, {
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
          disabled={!canRemove}
          onClick={() => onRemove(index)}
          aria-label="Retirer ce médicament"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
