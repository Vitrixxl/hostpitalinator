import type { FormEvent } from "react";
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border bg-background p-4 shadow sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-medium">
            Création d'un nouveau patient
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identité, coordonnées et affectation initiale.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>

      {error && <AlertMessage message={error} />}

      <form className="space-y-4" onSubmit={onSubmit}>
        <section className="rounded-3xl border bg-background p-4 shadow">
          <SectionTitle icon={UserPlus} title="Données administratives" />
          <PatientFormFields
            account={account}
            administrativeRequired
            beds={beds}
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
