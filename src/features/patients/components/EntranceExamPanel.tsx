import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Save, Search } from "lucide-react";

import { searchClinicalReferences } from "@/api";
import { formatShortDateTime } from "@/app/date-utils";
import { errorMessage } from "@/app/error-utils";
import { emptyAntecedentForm } from "@/app/form-state";
import type { AntecedentFormState, EntranceExamFormState } from "@/app/types";
import { Field } from "@/components/common/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AntecedentCategory,
  ClinicalReference,
  ClinicalReferenceKind,
  EntranceExamRecord,
} from "@/types";

const CLINICAL_REFERENCE_QUERY_MIN_LENGTH = 2;

const ANTECEDENT_LABELS: Record<AntecedentCategory, string> = {
  pathology: "Pathologies",
  medical_act: "Actes médicaux",
};

const VISIBLE_ANTECEDENT_CATEGORIES = ["pathology", "medical_act"] as const;

export function EntranceExamPanel({
  exams,
  form,
  hasMoreExams,
  hasCurrentExam,
  loadingExams,
  patientHasActiveVisit,
  currentVisitId,
  onChange,
  onLoadMore,
  onSubmit,
}: {
  exams: EntranceExamRecord[];
  form: EntranceExamFormState;
  hasMoreExams: boolean;
  hasCurrentExam: boolean;
  loadingExams: boolean;
  patientHasActiveVisit: boolean;
  currentVisitId?: string | null;
  onChange: (form: EntranceExamFormState) => void;
  onLoadMore: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [pendingAntecedentIds, setPendingAntecedentIds] = useState<
    Partial<Record<AntecedentCategory, string>>
  >({});
  const hasPendingAntecedent = form.antecedents.some((antecedent) =>
    Object.values(pendingAntecedentIds).includes(antecedent.id),
  );
  const isDraftMode = !patientHasActiveVisit;
  const visibleExams = exams.filter((exam) => !exam.isDraft);

  function updateField(
    field: "lifestyle" | "diseaseHistory" | "synthesis",
    value: string,
  ) {
    onChange({ ...form, [field]: value });
  }

  function addAntecedent(category: AntecedentCategory) {
    if (!patientHasActiveVisit || hasPendingAntecedent) {
      return;
    }

    const antecedent = emptyAntecedentForm(category);
    setPendingAntecedentIds({ [category]: antecedent.id });
    onChange({
      ...form,
      antecedents: [...form.antecedents, antecedent],
    });
  }

  function updateAntecedent(
    antecedentId: string,
    patch: Partial<AntecedentFormState>,
  ) {
    onChange({
      ...form,
      antecedents: form.antecedents.map((antecedent) =>
        antecedent.id === antecedentId
          ? { ...antecedent, ...patch }
          : antecedent,
      ),
    });
  }

  function removeAntecedent(antecedentId: string) {
    setPendingAntecedentIds((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, id]) => id !== antecedentId),
      ),
    );
    onChange({
      ...form,
      antecedents: form.antecedents.filter(
        (antecedent) => antecedent.id !== antecedentId,
      ),
    });
  }

  const groupedAntecedents = groupAntecedents(form.antecedents);

  return (
    <form className="grid gap-4 rounded-3xl" onSubmit={onSubmit}>
      {!patientHasActiveVisit && (
        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Aucun passage actif. Les informations enregistrées ici resteront en
          brouillon et seront reprises à la prochaine visite.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-4">
          <section
            className={cn(
              "grid gap-3 rounded-3xl border bg-background p-4 shadow-sm",
              isDraftMode && "border-dashed border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-lg font-medium ">
                    Examen courant
                  </h3>
                  {isDraftMode && <Badge variant="secondary">Brouillon</Badge>}
                </div>
                {isDraftMode && (
                  <p className="text-sm text-muted-foreground">
                    Données conservées hors visite active.
                  </p>
                )}
              </div>
              <Button type="submit">
                <Save className="size-4" />
                {entranceExamSubmitLabel(patientHasActiveVisit, hasCurrentExam)}
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Mode de vie">
                <Textarea
                  className="min-h-40"
                  value={form.lifestyle}
                  onChange={(event) =>
                    updateField("lifestyle", event.target.value)
                  }
                />
              </Field>
              <Field label="Historique de la maladie">
                <Textarea
                  className="min-h-40"
                  value={form.diseaseHistory}
                  onChange={(event) =>
                    updateField("diseaseHistory", event.target.value)
                  }
                />
              </Field>
              <Field label="Synthèse">
                <Textarea
                  className="min-h-40"
                  value={form.synthesis}
                  onChange={(event) =>
                    updateField("synthesis", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="font-heading text-base font-medium">
              Examens d'entrée
            </h3>
            {visibleExams.length === 0 && !loadingExams ? (
              <div className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
                Aucun examen d'entrée enregistré.
              </div>
            ) : (
              <div className="grid gap-3">
                {visibleExams.map((exam) => (
                  <EntranceExamHistoryCard
                    key={exam.id}
                    exam={exam}
                    active={
                      Boolean(currentVisitId) && exam.visitId === currentVisitId
                    }
                  />
                ))}
              </div>
            )}
            {hasMoreExams || loadingExams ? (
              <Button
                type="button"
                variant="outline"
                disabled={loadingExams}
                onClick={onLoadMore}
              >
                {loadingExams ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Charger 5 examens
              </Button>
            ) : null}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          {VISIBLE_ANTECEDENT_CATEGORIES.map((category) => (
            <div
              key={category}
              className="grid content-start gap-3 rounded-3xl border bg-background p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{ANTECEDENT_LABELS[category]}</p>
                <Badge variant="secondary">
                  {groupedAntecedents[category].length}
                </Badge>
              </div>
              {groupedAntecedents[category].map((antecedent) => (
                <AntecedentEditor
                  key={antecedent.id}
                  antecedent={antecedent}
                  onChange={(patch) => updateAntecedent(antecedent.id, patch)}
                  onRemove={() => removeAntecedent(antecedent.id)}
                />
              ))}
              {patientHasActiveVisit && !hasPendingAntecedent && (
                <button
                  type="button"
                  className="grid min-h-24 place-items-center rounded-lg border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => addAntecedent(category)}
                >
                  <span className="grid place-items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-full border border-dashed bg-background">
                      <Plus className="size-4" />
                    </span>
                    <span>{addAntecedentLabel(category)}</span>
                  </span>
                </button>
              )}
              {groupedAntecedents[category].length === 0 && (
                <span className="sr-only">Aucun élément renseigné</span>
              )}
            </div>
          ))}
        </aside>
      </div>
    </form>
  );
}

function EntranceExamHistoryCard({
  exam,
  active,
}: {
  exam: EntranceExamRecord;
  active: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-3xl border bg-background p-4 shadow-sm",
        active && "border-primary/60 bg-primary/5 shadow-primary/10",
      )}
    >
      <div className="flex justify-between">
        <div className="grid gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{exam.service}</p>
              {active && <Badge>Visite active</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatShortDateTime(exam.createdAt)} · Passage {exam.visitId}
            </p>
          </div>
        </div>
        <div className="grid content-start gap-1">
          <span className="text-4xl leading-none font-semibold text-primary">
            {examDateDay(exam.createdAt)}
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {examDateMonthYear(exam.createdAt)}
          </span>
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-3 w-full">
        <HistoryTextBlock label="Mode de vie" value={exam.lifestyle} />
        <HistoryTextBlock label="Historique" value={exam.diseaseHistory} />
        <HistoryTextBlock label="Synthèse" value={exam.synthesis} />
      </div>
    </article>
  );
}

function entranceExamSubmitLabel(
  patientHasActiveVisit: boolean,
  hasCurrentExam: boolean,
) {
  if (!patientHasActiveVisit) {
    return "Sauvegarder le brouillon";
  }

  return hasCurrentExam ? "Mettre à jour" : "Enregistrer";
}

function HistoryTextBlock({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">
        {value?.trim() ? value : "Non renseigné"}
      </p>
    </div>
  );
}

function examDateDay(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("fr-FR", { day: "2-digit" });
}

function examDateMonthYear(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }

  return date.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
}

function addAntecedentLabel(category: AntecedentCategory) {
  if (category === "pathology") {
    return "Ajouter une pathologie";
  }

  if (category === "medical_act") {
    return "Ajouter un acte";
  }

  return "Ajouter une entrée";
}

function AntecedentEditor({
  antecedent,
  onChange,
  onRemove,
}: {
  antecedent: AntecedentFormState;
  onChange: (patch: Partial<AntecedentFormState>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border p-3">
      <div className="flex items-center justify-between gap-2"></div>

      <ClinicalReferenceInput antecedent={antecedent} onChange={onChange} />

      {(antecedent.source || antecedent.code) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {antecedent.source && (
            <Badge variant="secondary">{antecedent.source}</Badge>
          )}
          {antecedent.code && (
            <Badge variant="outline">{antecedent.code}</Badge>
          )}
        </div>
      )}

      <Field label="Notes">
        <Textarea
          className="min-h-20"
          value={antecedent.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          aria-label="Supprimer l'antécédent"
          className="flex-1"
          onClick={onRemove}
        >
          Annuler
        </Button>
        <Button
          className="flex-1"
          type="submit"
          variant="default"
          aria-label="Ajouter l'antécédent"
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}

function ClinicalReferenceInput({
  antecedent,
  onChange,
}: {
  antecedent: AntecedentFormState;
  onChange: (patch: Partial<AntecedentFormState>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClinicalReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [popoverContainer, setPopoverContainer] =
    useState<HTMLDivElement | null>(null);
  const kind = antecedent.category as ClinicalReferenceKind;
  const query = antecedent.referenceQuery.trim();
  const selected = antecedent.code !== "";

  useEffect(() => {
    if (selected || query.length < CLINICAL_REFERENCE_QUERY_MIN_LENGTH) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setSearchError("");

      searchClinicalReferences(kind, query)
        .then((references) => {
          if (!cancelled) {
            setResults(references);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setResults([]);
            setSearchError(errorMessage(error));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [kind, query, selected]);

  function handleQueryChange(value: string) {
    const hasSearchLength =
      value.trim().length >= CLINICAL_REFERENCE_QUERY_MIN_LENGTH;

    setResults([]);
    setLoading(hasSearchLength);
    setSearchError("");
    setOpen(hasSearchLength);
    onChange({
      source: "",
      code: "",
      label: value,
      referenceQuery: value,
    });
  }

  function selectReference(reference: ClinicalReference) {
    onChange({
      source: reference.source,
      code: reference.code,
      label: reference.label,
      referenceQuery: `${reference.code} - ${reference.label}`,
    });
    setOpen(false);
    setResults([]);
    setLoading(false);
    setSearchError("");
  }

  const showResults =
    open && !selected && query.length >= CLINICAL_REFERENCE_QUERY_MIN_LENGTH;

  return (
    <div ref={setPopoverContainer} className="grid gap-1">
      <Field label={antecedent.category === "pathology" ? "CIM-10" : "CCAM"}>
        <Popover open={showResults} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pr-2.5 pl-8"
                value={antecedent.referenceQuery || antecedent.label}
                onFocus={() => setOpen(true)}
                onChange={(event) => handleQueryChange(event.target.value)}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="end"
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
                  Aucune référence trouvée
                </p>
              )}
              {!loading &&
                !searchError &&
                results.map((reference) => (
                  <button
                    key={reference.id}
                    type="button"
                    className="grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => selectReference(reference)}
                  >
                    <span className="font-medium">{reference.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {reference.source} {reference.code}
                    </span>
                  </button>
                ))}
            </div>
          </PopoverContent>
        </Popover>
      </Field>
      {selected && (
        <button
          type="button"
          className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() =>
            onChange({
              source: "",
              code: "",
              referenceQuery: antecedent.label,
            })
          }
        >
          Modifier la référence
        </button>
      )}
    </div>
  );
}

function groupAntecedents(antecedents: AntecedentFormState[]) {
  return antecedents.reduce(
    (groups, antecedent) => {
      groups[antecedent.category].push(antecedent);
      return groups;
    },
    {
      pathology: [],
      medical_act: [],
    } as Record<AntecedentCategory, AntecedentFormState[]>,
  );
}
