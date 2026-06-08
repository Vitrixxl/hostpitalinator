import { useMemo } from "react";

import { BedIcon, Building2, Mars, Venus } from "lucide-react";

import {
  PATIENT_SEX_LABELS,
  UNASSIGNED_BED_VALUE,
  UNSELECTED_SERVICE_VALUE,
} from "@/app/constants";
import { bedLabelText } from "@/app/formatters";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { Bed, PatientIdentifier, Service } from "@/types";

import { Field } from "./Field";

const SEX_TOGGLE_OPTIONS = [
  {
    value: "male",
    Icon: Mars,
    className:
      "hover:border-blue-200 hover:text-blue-700 data-[state=on]:border-blue-300 data-[state=on]:bg-blue-50 data-[state=on]:text-blue-700 dark:hover:border-blue-400/40 dark:hover:text-blue-200 dark:data-[state=on]:border-blue-400/50 dark:data-[state=on]:bg-blue-950/35 dark:data-[state=on]:text-blue-200",
  },
  {
    value: "female",
    Icon: Venus,
    className:
      "hover:border-pink-200 hover:text-pink-700 data-[state=on]:border-pink-300 data-[state=on]:bg-pink-50 data-[state=on]:text-pink-700 dark:hover:border-pink-400/40 dark:hover:text-pink-200 dark:data-[state=on]:border-pink-400/50 dark:data-[state=on]:bg-pink-950/35 dark:data-[state=on]:text-pink-200",
  },
] as const;

export function NumberField({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <Input
        required={required}
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function SexSelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue || !required) {
          onChange(nextValue);
        }
      }}
      aria-label="Sexe"
      className="w-full gap-2 h-9 bg-transparent p-0 border-none"
    >
      {SEX_TOGGLE_OPTIONS.map(({ value: sex, Icon, className }) => (
        <ToggleGroupItem
          key={sex}
          value={sex}
          aria-label={`Sexe: ${PATIENT_SEX_LABELS[sex]}`}
          className={cn(
            "h-9 min-w-[5.25rem] border border-transparent px-2.5 flex-1",
            className,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {PATIENT_SEX_LABELS[sex]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function BedSelect({
  beds,
  service,
  currentPatientId,
  value,
  onChange,
}: {
  beds: Bed[];
  service?: string;
  currentPatientId?: PatientIdentifier;
  value: string;
  onChange: (value: string) => void;
}) {
  const assignableBeds = useMemo(
    () =>
      beds.filter(
        (bed) =>
          (!service || bed.service === service) &&
          (!bed.occupiedPatientId ||
            bed.occupiedPatientId === currentPatientId),
      ),
    [beds, currentPatientId, service],
  );

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
        <SelectItem value={UNASSIGNED_BED_VALUE}>Non assigné</SelectItem>
        {assignableBeds.map((bed) => (
          <SelectItem key={bed.id} value={bed.id}>
            {bedLabelText(bed)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ServiceSelect({
  services,
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  services: Service[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Select
      value={value || UNSELECTED_SERVICE_VALUE}
      onValueChange={(nextValue) => {
        if (nextValue !== UNSELECTED_SERVICE_VALUE) {
          onChange(nextValue);
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
          Sélectionner un service
        </SelectItem>
        {services.map((service) => (
          <SelectItem key={service.id} value={service.name}>
            {service.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
