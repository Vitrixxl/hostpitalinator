import { useId, useState } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldErrors } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { emptyPatientContactPersonForm } from "@/app/form-state";
import {
  validateOptionalEmail,
  validateOptionalPhone,
  validateRequired,
  validateRequiredEmail,
  validateRequiredPhone,
} from "@/app/form-validation";
import type {
  PatientContactPersonFormState,
  PatientFormState,
} from "@/app/types";
import { AddressAutocomplete } from "@/components/common/AddressAutocomplete";
import { DateTextInput } from "@/components/common/DateInputs";
import { Field } from "@/components/common/Field";
import {
  BedSelect,
  ServiceSelect,
  SexSelect,
} from "@/components/common/FormControls";
import { RichTextNoteField } from "@/components/common/RichText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Account, Bed, PatientIdentifier, Service } from "@/types";

type ContactDraftErrors = {
  email?: string;
  form?: string;
  phoneNumber?: string;
};

export function PatientFormFields({
  account,
  administrativeRequired = false,
  beds,
  control,
  currentPatientId,
  errors,
  form,
  showBedField = true,
  showServiceField = true,
  services,
  onChange,
}: {
  account: Account;
  administrativeRequired?: boolean;
  beds: Bed[];
  control: Control<PatientFormState>;
  currentPatientId?: PatientIdentifier;
  errors: FieldErrors<PatientFormState>;
  form: PatientFormState;
  showBedField?: boolean;
  showServiceField?: boolean;
  services: Service[];
  onChange: (form: PatientFormState) => void;
}) {
  function updateField(
    field: Exclude<keyof PatientFormState, "contactPersons">,
    value: string,
  ) {
    onChange({ ...form, [field]: value });
  }

  function updateContactPersonField(
    clientId: string,
    field: "name" | "relationship" | "phoneNumber" | "email",
    value: string,
  ) {
    onChange({
      ...form,
      contactPersons: form.contactPersons.map((contactPerson) =>
        contactPerson.clientId === clientId
          ? { ...contactPerson, [field]: value }
          : contactPerson,
      ),
    });
  }

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactDraft, setContactDraft] =
    useState<PatientContactPersonFormState>(() =>
      emptyPatientContactPersonForm(),
    );
  const [contactDraftErrors, setContactDraftErrors] =
    useState<ContactDraftErrors>({});

  function removeContactPerson(clientId: string) {
    const contactPersons = form.contactPersons.filter(
      (contactPerson) => contactPerson.clientId !== clientId,
    );

    onChange({
      ...form,
      contactPersons: contactPersons.length
        ? contactPersons
        : [emptyPatientContactPersonForm()],
    });
  }

  function openContactDialog() {
    setContactDraft(emptyPatientContactPersonForm());
    setContactDraftErrors({});
    setContactDialogOpen(true);
  }

  function updateContactDraftField(
    field: "name" | "relationship" | "phoneNumber" | "email",
    value: string,
  ) {
    setContactDraft((current) => ({ ...current, [field]: value }));
    setContactDraftErrors({});
  }

  function submitContactDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: ContactDraftErrors = {};
    const phoneValidation = validateOptionalPhone(contactDraft.phoneNumber);
    const emailValidation = validateOptionalEmail(contactDraft.email);

    if (!contactPersonHasValue(contactDraft)) {
      nextErrors.form = "Renseignez au moins une information.";
    }

    if (phoneValidation !== true) {
      nextErrors.phoneNumber = phoneValidation;
    }

    if (emailValidation !== true) {
      nextErrors.email = emailValidation;
    }

    if (Object.keys(nextErrors).length > 0) {
      setContactDraftErrors(nextErrors);
      return;
    }

    onChange({
      ...form,
      contactPersons: [
        ...form.contactPersons.filter(contactPersonHasValue),
        contactDraft,
      ],
    });
    setContactDialogOpen(false);
    setContactDraft(emptyPatientContactPersonForm());
    setContactDraftErrors({});
  }

  const addressInputId = useId();
  const contactPersonsForTable = form.contactPersons.some(
    contactPersonHasValue,
  )
    ? form.contactPersons
    : [];

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Prénom" required error={errors.firstName?.message}>
          <Controller
            control={control}
            name="firstName"
            rules={{ validate: validateRequired }}
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.firstName}
                value={field.value ?? ""}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  updateField("firstName", event.target.value);
                }}
              />
            )}
          />
        </Field>
        <Field label="Nom" required error={errors.lastName?.message}>
          <Controller
            control={control}
            name="lastName"
            rules={{ validate: validateRequired }}
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.lastName}
                value={field.value ?? ""}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  updateField("lastName", event.target.value);
                }}
              />
            )}
          />
        </Field>
        <Field
          label="Date de naissance"
          required
          error={errors.birthDate?.message}
        >
          <Controller
            control={control}
            name="birthDate"
            rules={{ validate: validateRequired }}
            render={({ field }) => (
              <DateTextInput
                aria-invalid={!!errors.birthDate}
                value={field.value ?? ""}
                onValueChange={(birthDate) => {
                  field.onChange(birthDate);
                  updateField("birthDate", birthDate);
                }}
              />
            )}
          />
        </Field>
        <Field
          label="Sexe"
          required={administrativeRequired}
          error={errors.sex?.message}
        >
          <Controller
            control={control}
            name="sex"
            rules={{
              validate: administrativeRequired ? validateRequired : undefined,
            }}
            render={({ field }) => (
              <SexSelect
                value={field.value ?? ""}
                required={administrativeRequired}
                onChange={(sex) => {
                  field.onChange(sex);
                  updateField("sex", sex);
                }}
              />
            )}
          />
        </Field>
        {showServiceField && (
          <Field
            label="Service"
            required
            error={errors.currentService?.message}
          >
            <Controller
              control={control}
              name="currentService"
              rules={{ validate: validateRequired }}
              render={({ field }) => (
                <ServiceSelect
                  services={services}
                  value={field.value ?? ""}
                  onChange={(currentService) => {
                    field.onChange(currentService);
                    onChange({ ...form, currentService, bedId: "" });
                  }}
                  disabled={account.role !== "admin"}
                />
              )}
            />
          </Field>
        )}
        {showBedField && (
          <Field label="Lit">
            <Controller
              control={control}
              name="bedId"
              render={({ field }) => (
                <BedSelect
                  beds={beds}
                  service={form.currentService || account.service}
                  currentPatientId={currentPatientId}
                  value={field.value ?? ""}
                  onChange={(bedId) => {
                    field.onChange(bedId);
                    updateField("bedId", bedId);
                  }}
                />
              )}
            />
          </Field>
        )}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_11rem]">
          <Field
            label="Adresse"
            required={administrativeRequired}
            error={errors.address?.message}
          >
            <Controller
              control={control}
              name="address"
              rules={{
                validate: administrativeRequired ? validateRequired : undefined,
              }}
              render={({ field }) => (
                <AddressAutocomplete
                  id={addressInputId}
                  aria-invalid={!!errors.address}
                  value={field.value ?? ""}
                  onChange={(address) => {
                    field.onChange(address);
                    updateField("address", address);
                  }}
                />
              )}
            />
          </Field>
          <Field label="Appartement">
            <Controller
              control={control}
              name="apartmentNumber"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Optionnel"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    updateField("apartmentNumber", event.target.value);
                  }}
                />
              )}
            />
          </Field>
        </div>
        <Field
          label="Téléphone"
          required={administrativeRequired}
          error={errors.phoneNumber?.message}
        >
          <Controller
            control={control}
            name="phoneNumber"
            rules={{
              validate: administrativeRequired
                ? validateRequiredPhone
                : validateOptionalPhone,
            }}
            render={({ field }) => (
              <Input
                {...field}
                type="tel"
                inputMode="tel"
                aria-invalid={!!errors.phoneNumber}
                value={field.value ?? ""}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  updateField("phoneNumber", event.target.value);
                }}
              />
            )}
          />
        </Field>
        <Field
          label="Courriel"
          required={administrativeRequired}
          error={errors.email?.message}
        >
          <Controller
            control={control}
            name="email"
            rules={{
              validate: administrativeRequired
                ? validateRequiredEmail
                : validateOptionalEmail,
            }}
            render={({ field }) => (
              <Input
                {...field}
                type="text"
                inputMode="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                value={field.value ?? ""}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  updateField("email", event.target.value);
                }}
              />
            )}
          />
        </Field>
      </div>

      <Field label="Informations administratives">
        <RichTextNoteField
          className="min-h-28"
          title="Informations administratives"
          placeholder="Informations administratives"
          value={form.administrativeInfo}
          onChange={(value) => updateField("administrativeInfo", value)}
        />
      </Field>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Personnes à contacter</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openContactDialog}
          >
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Lien</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Courriel</TableHead>
                <TableHead className="w-px px-1 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactPersonsForTable.map((contactPerson, index) => (
                <TableRow key={contactPerson.clientId}>
                  <TableCell className="min-w-56 align-top">
                    <Input
                      aria-label={`Nom du contact ${index + 1}`}
                      placeholder="Optionnel"
                      value={contactPerson.name}
                      onChange={(event) =>
                        updateContactPersonField(
                          contactPerson.clientId,
                          "name",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="min-w-56 align-top">
                    <Input
                      aria-label={`Lien du contact ${index + 1}`}
                      placeholder="Parent, conjoint..."
                      value={contactPerson.relationship}
                      onChange={(event) =>
                        updateContactPersonField(
                          contactPerson.clientId,
                          "relationship",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="min-w-56 align-top">
                    <Controller
                      control={control}
                      name={`contactPersons.${index}.phoneNumber`}
                      rules={{ validate: validateOptionalPhone }}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="tel"
                          inputMode="tel"
                          aria-label={`Téléphone du contact ${index + 1}`}
                          aria-invalid={
                            !!errors.contactPersons?.[index]?.phoneNumber
                          }
                          placeholder="Optionnel"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            updateContactPersonField(
                              contactPerson.clientId,
                              "phoneNumber",
                              event.target.value,
                            );
                          }}
                        />
                      )}
                    />
                    {errors.contactPersons?.[index]?.phoneNumber?.message && (
                      <span
                        className="text-xs font-normal text-destructive"
                        role="alert"
                      >
                        {errors.contactPersons[index]?.phoneNumber?.message}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-56 align-top">
                    <Controller
                      control={control}
                      name={`contactPersons.${index}.email`}
                      rules={{ validate: validateOptionalEmail }}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="text"
                          inputMode="email"
                          autoComplete="email"
                          aria-label={`Courriel du contact ${index + 1}`}
                          aria-invalid={
                            !!errors.contactPersons?.[index]?.email
                          }
                          placeholder="Optionnel"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            updateContactPersonField(
                              contactPerson.clientId,
                              "email",
                              event.target.value,
                            );
                          }}
                        />
                      )}
                    />
                    {errors.contactPersons?.[index]?.email?.message && (
                      <span
                        className="text-xs font-normal text-destructive"
                        role="alert"
                      >
                        {errors.contactPersons[index]?.email?.message}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="w-px px-1 align-top">
                    {contactPersonsForTable.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer le contact ${index + 1}`}
                        onClick={() =>
                          removeContactPerson(contactPerson.clientId)
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {contactPersonsForTable.length === 0 && (
                <TableEmptyRow colSpan={5}>
                  Aucune personne à contacter
                </TableEmptyRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form className="grid gap-4" onSubmit={submitContactDialog}>
            <DialogHeader>
              <DialogTitle>Ajouter une personne à contacter</DialogTitle>
              <DialogDescription>
                Renseignez les informations disponibles pour ce contact.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nom">
                <Input
                  placeholder="Optionnel"
                  value={contactDraft.name}
                  onChange={(event) =>
                    updateContactDraftField("name", event.target.value)
                  }
                />
              </Field>
              <Field label="Lien">
                <Input
                  placeholder="Parent, conjoint..."
                  value={contactDraft.relationship}
                  onChange={(event) =>
                    updateContactDraftField(
                      "relationship",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Téléphone" error={contactDraftErrors.phoneNumber}>
                <Input
                  type="tel"
                  inputMode="tel"
                  aria-invalid={!!contactDraftErrors.phoneNumber}
                  placeholder="Optionnel"
                  value={contactDraft.phoneNumber}
                  onChange={(event) =>
                    updateContactDraftField("phoneNumber", event.target.value)
                  }
                />
              </Field>
              <Field label="Courriel" error={contactDraftErrors.email}>
                <Input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={!!contactDraftErrors.email}
                  placeholder="Optionnel"
                  value={contactDraft.email}
                  onChange={(event) =>
                    updateContactDraftField("email", event.target.value)
                  }
                />
              </Field>
            </div>
            {contactDraftErrors.form && (
              <p className="text-sm text-destructive" role="alert">
                {contactDraftErrors.form}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setContactDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                <Plus className="size-4" />
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function contactPersonHasValue(contactPerson: PatientContactPersonFormState) {
  return (
    contactPerson.name.trim() !== "" ||
    contactPerson.relationship.trim() !== "" ||
    contactPerson.phoneNumber.trim() !== "" ||
    contactPerson.email.trim() !== ""
  );
}
