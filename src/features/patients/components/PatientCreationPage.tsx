import { useForm } from "react-hook-form";
import { Plus, UserPlus } from "lucide-react";

import type { PatientFormState } from "@/app/types";
import { AlertMessage } from "@/components/common/Feedback";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Button } from "@/components/ui/button";
import type { Account, Bed, Service } from "@/types";

import { PatientFormFields } from "./PatientFormFields";

export function PatientCreationPage({
  account,
  beds,
  error,
  form,
  services,
  onCancel,
  onChange,
  onSubmit,
}: {
  account: Account;
  beds: Bed[];
  error: string;
  form: PatientFormState;
  services: Service[];
  onCancel: () => void;
  onChange: (form: PatientFormState) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const patientForm = useForm<PatientFormState>({
    values: form,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-medium">
            Création d'un nouveau patient
          </h1>
          <p className="text-sm text-muted-foreground">
            Identité, coordonnées et affectation initiale.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>

      {error && <AlertMessage message={error} />}

      <form
        className="space-y-4"
        noValidate
        onSubmit={patientForm.handleSubmit(onSubmit)}
      >
        <section className="rounded-lg border border-border bg-card p-3">
          <SectionTitle icon={UserPlus} title="Données administratives" />
          <PatientFormFields
            account={account}
            administrativeRequired
            beds={beds}
            control={patientForm.control}
            errors={patientForm.formState.errors}
            form={form}
            services={services}
            onChange={onChange}
          />
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit">
            <Plus className="size-4" />
            Créer le dossier
          </Button>
        </div>
      </form>
    </div>
  );
}
