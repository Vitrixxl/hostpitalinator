import { BedIcon, Building2, Users } from "lucide-react"

import {
  PATIENT_SEX_LABELS,
  PATIENT_SEXES,
  UNASSIGNED_BED_VALUE,
  UNSELECTED_SERVICE_VALUE,
} from "@/app/constants"
import { bedLabelText } from "@/app/formatters"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Bed, Service } from "@/types"

import { Field } from "./Field"

export function NumberField({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <Field label={label}>
      <Input
        required={required}
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export function SexSelect({
  value,
  onChange,
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} required={required}>
      <SelectTrigger className="max-w-full">
        <Users className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Selectionner" />
      </SelectTrigger>
      <SelectContent>
        {PATIENT_SEXES.map((sex) => (
          <SelectItem key={sex} value={sex}>
            {PATIENT_SEX_LABELS[sex]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function BedSelect({
  beds,
  service,
  currentPatientId,
  value,
  onChange,
}: {
  beds: Bed[]
  service?: string
  currentPatientId?: string
  value: string
  onChange: (value: string) => void
}) {
  const assignableBeds = beds.filter(
    (bed) =>
      (!service || bed.service === service) &&
      (!bed.occupiedPatientId || bed.occupiedPatientId === currentPatientId)
  )

  return (
    <Select
      value={value || UNASSIGNED_BED_VALUE}
      onValueChange={(nextValue) =>
        onChange(nextValue === UNASSIGNED_BED_VALUE ? "" : nextValue)
      }
    >
      <SelectTrigger className="max-w-full">
        <BedIcon className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Lit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED_BED_VALUE}>Non assigne</SelectItem>
        {assignableBeds.map((bed) => (
          <SelectItem key={bed.id} value={bed.id}>
            {bedLabelText(bed)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ServiceSelect({
  services,
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  services: Service[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}) {
  return (
    <Select
      value={value || UNSELECTED_SERVICE_VALUE}
      onValueChange={(nextValue) => {
        if (nextValue !== UNSELECTED_SERVICE_VALUE) {
          onChange(nextValue)
        }
      }}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger className="max-w-full">
        <Building2 className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Service" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSELECTED_SERVICE_VALUE} disabled>
          Selectionner un service
        </SelectItem>
        {services.map((service) => (
          <SelectItem key={service.id} value={service.name}>
            {service.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
