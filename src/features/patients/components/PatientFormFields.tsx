import { useId } from "react"

import type { PatientFormState } from "@/app/types"
import { AddressAutocomplete } from "@/components/common/AddressAutocomplete"
import { DateTextInput } from "@/components/common/DateInputs"
import { Field } from "@/components/common/Field"
import { BedSelect, ServiceSelect, SexSelect } from "@/components/common/FormControls"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Account, Bed, Service } from "@/types"

export function PatientFormFields({
  account,
  administrativeRequired = false,
  beds,
  currentPatientId,
  form,
  services,
  onChange,
}: {
  account: Account
  administrativeRequired?: boolean
  beds: Bed[]
  currentPatientId?: string
  form: PatientFormState
  services: Service[]
  onChange: (form: PatientFormState) => void
}) {
  function updateField(field: keyof PatientFormState, value: string) {
    onChange({ ...form, [field]: value })
  }

  const addressInputId = useId()

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Prenom">
          <Input
            required
            value={form.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
          />
        </Field>
        <Field label="Nom">
          <Input
            required
            value={form.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
          />
        </Field>
        <Field label="Date de naissance">
          <DateTextInput
            required
            value={form.birthDate}
            onValueChange={(birthDate) => updateField("birthDate", birthDate)}
          />
        </Field>
        <Field label="Sexe">
          <SexSelect
            required={administrativeRequired}
            value={form.sex}
            onChange={(sex) => updateField("sex", sex)}
          />
        </Field>
        <Field label="Service">
          <ServiceSelect
            services={services}
            required
            value={form.currentService}
            onChange={(currentService) =>
              onChange({ ...form, currentService, bedId: "" })
            }
            disabled={account.role !== "admin"}
          />
        </Field>
        <Field label="Lit">
          <BedSelect
            beds={beds}
            service={form.currentService || account.service}
            currentPatientId={currentPatientId}
            value={form.bedId}
            onChange={(bedId) => updateField("bedId", bedId)}
          />
        </Field>
        <div className="grid gap-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="grid gap-1.5">
            <Label htmlFor={addressInputId}>Adresse</Label>
            <AddressAutocomplete
              id={addressInputId}
              required={administrativeRequired}
              value={form.address}
              onChange={(address) => updateField("address", address)}
            />
          </div>
          <Field label="Appartement">
            <Input
              placeholder="Optionnel"
              value={form.apartmentNumber}
              onChange={(event) =>
                updateField("apartmentNumber", event.target.value)
              }
            />
          </Field>
        </div>
        <Field label="Telephone">
          <Input
            required={administrativeRequired}
            type="tel"
            value={form.phoneNumber}
            onChange={(event) => updateField("phoneNumber", event.target.value)}
          />
        </Field>
        <Field label="Courriel">
          <Input
            required={administrativeRequired}
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </Field>
      </div>

      <Field label="Informations administratives">
        <Textarea
          className="min-h-28"
          value={form.administrativeInfo}
          onChange={(event) =>
            updateField("administrativeInfo", event.target.value)
          }
        />
      </Field>
    </div>
  )
}
