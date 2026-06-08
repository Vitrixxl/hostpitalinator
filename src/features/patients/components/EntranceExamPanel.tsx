import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  ScanLine,
  Search,
  Trash2,
} from "lucide-react";

import { searchClinicalReferences } from "@/api";
import { formatShortDateTime } from "@/app/date-utils";
import { errorMessage } from "@/app/error-utils";
import { emptyAntecedentForm } from "@/app/form-state";
import { richTextHasText } from "@/app/rich-text";
import type { AntecedentFormState, EntranceExamFormState } from "@/app/types";
import { Field } from "@/components/common/Field";
import { RichTextDisplay, RichTextNoteField } from "@/components/common/RichText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { canOpenDicomViewer } from "@/features/documents/imaging-document-utils";
import { cn } from "@/lib/utils";
import type {
  AntecedentCategory,
  ClinicalReference,
  ClinicalReferenceKind,
  EntranceExamRecord,
  MedicalDocument,
} from "@/types";

const CLINICAL_REFERENCE_QUERY_MIN_LENGTH = 2;
const ANTECEDENT_EDIT_WINDOW_MS = 60 * 60 * 1000;
const ANTECEDENT_EDIT_REFRESH_INTERVAL_MS = 60 * 1000;

const ANTECEDENT_LABELS: Record<AntecedentCategory, string> = {
  pathology: "Pathologies",
  medical_history: "Antécédents médicaux",
  surgery: "Chirurgie",
};

const VISIBLE_ANTECEDENT_CATEGORIES: AntecedentCategory[] = [
  "pathology",
  "medical_history",
  "surgery",
];

export function EntranceExamPanel({
  exams,
  form,
  hasMoreExams,
  hasCurrentExam,
  loadingExams,
  patientHasActiveVisit,
  currentVisitId,
  imagingDocuments,
  readOnly = false,
  readOnlyDescription,
  onChange,
  onPrepareEntranceExam,
  onViewImagingDocument,
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
  imagingDocuments: MedicalDocument[];
  readOnly?: boolean;
  readOnlyDescription?: string;
  onChange: (form: EntranceExamFormState) => void;
  onPrepareEntranceExam?: () => void;
  onViewImagingDocument: (document: MedicalDocument) => void;
  onLoadMore: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [pendingAntecedentIds, setPendingAntecedentIds] = useState<
    Partial<Record<AntecedentCategory, string>>
  >({});
  const [editingAntecedentIds, setEditingAntecedentIds] = useState<
    Record<string, boolean>
  >({});
  const [selectedHistoryExam, setSelectedHistoryExam] =
    useState<EntranceExamRecord | null>(null);
  const [antecedentEditNow, setAntecedentEditNow] = useState(() => Date.now());
  const hasPendingAntecedent = form.antecedents.some((antecedent) =>
    Object.values(pendingAntecedentIds).includes(antecedent.id),
  );
  const isDraftMode = !patientHasActiveVisit;
  const visibleExams = useMemo(
    () => exams.filter((exam) => !exam.isDraft),
    [exams],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAntecedentEditNow(Date.now());
    }, ANTECEDENT_EDIT_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  function updateField(
    field:
      | "admissionReason"
      | "lifestyle"
      | "entranceTreatment"
      | "diseaseHistory"
      | "clinicalExam"
      | "allergies"
      | "synthesis",
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
    setEditingAntecedentIds((current) => {
      const next = { ...current };
      delete next[antecedentId];

      return next;
    });
    onChange({
      ...form,
      antecedents: form.antecedents.filter(
        (antecedent) => antecedent.id !== antecedentId,
      ),
    });
  }

  function editAntecedent(antecedentId: string) {
    setEditingAntecedentIds((current) => ({
      ...current,
      [antecedentId]: true,
    }));
  }

  const groupedAntecedents = useMemo(
    () => groupAntecedents(form.antecedents),
    [form.antecedents],
  );

  return (
    <>
      <form
        className="grid gap-4 rounded-3xl"
        onSubmit={readOnly ? (event) => event.preventDefault() : onSubmit}
      >
      {!patientHasActiveVisit && (
        <div className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          Aucun passage actif. Les informations enregistrées ici resteront en
          brouillon et seront reprises à la prochaine visite.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-4">
          <section
            className={cn(
              "grid gap-3 rounded-lg border border-border bg-card p-3",
              isDraftMode && "border-dashed border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-lg font-medium ">
                    Bilan médical initial
                  </h3>
                  {isDraftMode && <Badge variant="secondary">Brouillon</Badge>}
                </div>
                {isDraftMode && (
                  <p className="text-sm text-muted-foreground">
                    Données conservées hors visite active.
                  </p>
                )}
              </div>
              {readOnly ? (
                onPrepareEntranceExam ? (
                  <Button type="button" onClick={onPrepareEntranceExam}>
                    <Plus className="size-4" />
                    Préparer un bilan d'entrée
                  </Button>
                ) : null
              ) : (
                <Button type="submit">
                  <Save className="size-4" />
                  {entranceExamSubmitLabel(
                    patientHasActiveVisit,
                    hasCurrentExam,
                  )}
                </Button>
              )}
            </div>
            {readOnlyDescription && (
              <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                {readOnlyDescription}
              </p>
            )}
            {readOnly ? (
              <EntranceExamReadOnlyFields form={form} />
            ) : (
              <>
                <Field label="Raison d'admission">
                  <RichTextNoteField
                    className="min-h-40"
                    title="Raison d'admission"
                    placeholder="Raison d'admission"
                    value={form.admissionReason}
                    onChange={(value) => updateField("admissionReason", value)}
                  />
                </Field>
                <Field label="Mode de vie">
                  <RichTextNoteField
                    className="min-h-40"
                    title="Mode de vie"
                    placeholder="Mode de vie"
                    value={form.lifestyle}
                    onChange={(value) => updateField("lifestyle", value)}
                  />
                </Field>
                <Field label="Traitement d'entrée">
                  <RichTextNoteField
                    className="min-h-40"
                    title="Traitement d'entrée"
                    placeholder="Traitement d'entrée"
                    value={form.entranceTreatment}
                    onChange={(value) =>
                      updateField("entranceTreatment", value)
                    }
                  />
                </Field>
                <Field label="Histoire de la maladie">
                  <RichTextNoteField
                    className="min-h-40"
                    title="Histoire de la maladie"
                    placeholder="Histoire de la maladie"
                    value={form.diseaseHistory}
                    onChange={(value) => updateField("diseaseHistory", value)}
                  />
                </Field>
                <Field label="Examen d'entrée">
                  <RichTextNoteField
                    className="min-h-40"
                    title="Examen d'entrée"
                    placeholder="Examen d'entrée"
                    value={form.clinicalExam}
                    onChange={(value) => updateField("clinicalExam", value)}
                  />
                </Field>
                <Field label="Allergies">
                  <RichTextNoteField
                    className="min-h-32"
                    title="Allergies"
                    placeholder="Allergies connues, intolérances, réactions..."
                    value={form.allergies}
                    onChange={(value) => updateField("allergies", value)}
                  />
                </Field>
                <Field label="Synthèse">
                  <RichTextNoteField
                    className="min-h-40"
                    title="Synthèse"
                    placeholder="Synthèse"
                    value={form.synthesis}
                    onChange={(value) => updateField("synthesis", value)}
                  />
                </Field>
              </>
            )}
          </section>

          <section className="grid gap-3">
            <h3 className="font-heading text-base font-medium">
              Examens d'entrée
            </h3>
            {visibleExams.length === 0 && !loadingExams ? (
              <div className="rounded-3xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
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
                    onOpen={() => setSelectedHistoryExam(exam)}
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
          <div className="grid content-start gap-3 rounded-3xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium">
                <ScanLine className="size-4" />
                Imagerie scanner
              </p>
              <Badge variant="secondary">{imagingDocuments.length}</Badge>
            </div>
            {imagingDocuments.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                Aucun document d'imagerie.
              </p>
            ) : (
              <div className="grid gap-2">
                {imagingDocuments.map((document) => {
                  const canView = canOpenDicomViewer(document);

                  return (
                    <div
                      key={document.id}
                      className="grid gap-2 rounded-2xl border bg-muted/20 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{document.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {document.originalFileName ??
                            document.storagePath ??
                            "Reference d'imagerie"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canView}
                        onClick={() => onViewImagingDocument(document)}
                      >
                        <ScanLine className="size-4" />
                        Visualiser
                      </Button>
                      {!canView && (
                        <p className="text-xs text-muted-foreground">
                          Fichier DICOM requis pour la vue Cornerstone.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {VISIBLE_ANTECEDENT_CATEGORIES.map((category) => (
            <div
              key={category}
              className="grid content-start gap-3 rounded-3xl border bg-card p-3"
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
                  canEdit={
                    !readOnly &&
                    isAntecedentEditable(antecedent, antecedentEditNow)
                  }
                  isEditing={Boolean(editingAntecedentIds[antecedent.id])}
                  isPending={pendingAntecedentIds[category] === antecedent.id}
                  onEdit={() => editAntecedent(antecedent.id)}
                  onChange={(patch) => updateAntecedent(antecedent.id, patch)}
                  onRemove={() => removeAntecedent(antecedent.id)}
                />
              ))}
              {!readOnly && patientHasActiveVisit && !hasPendingAntecedent && (
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
      <EntranceExamHistoryDialog
        exam={selectedHistoryExam}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHistoryExam(null);
          }
        }}
      />
    </>
  );
}

function EntranceExamHistoryCard({
  exam,
  active,
  onOpen,
}: {
  exam: EntranceExamRecord;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-col gap-3 rounded-3xl border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "border-primary/60 bg-primary/5 shadow-primary/10",
      )}
      onClick={onOpen}
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
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Raison d'admission
        </p>
        <RichTextDisplay
          className="mt-1 text-sm"
          fallback="Non renseigné"
          value={exam.admissionReason}
        />
      </div>
    </button>
  );
}

function EntranceExamHistoryDialog({
  exam,
  onOpenChange,
}: {
  exam: EntranceExamRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={exam !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {exam && (
          <>
            <DialogHeader>
              <DialogTitle>Examen d'entrée</DialogTitle>
              <DialogDescription>
                {exam.service} · {formatShortDateTime(exam.createdAt)} ·
                Passage {exam.visitId}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="grid gap-3 pr-2">
                <HistoryTextBlock
                  label="Raison d'admission"
                  value={exam.admissionReason}
                />
                <HistoryTextBlock label="Mode de vie" value={exam.lifestyle} />
                <HistoryTextBlock
                  label="Traitement d'entrée"
                  value={exam.entranceTreatment}
                />
                <HistoryTextBlock
                  label="Histoire de la maladie"
                  value={exam.diseaseHistory}
                />
                <HistoryTextBlock
                  label="Examen d'entrée"
                  value={exam.clinicalExam}
                />
                <HistoryTextBlock label="Allergies" value={exam.allergies} />
                <HistoryTextBlock label="Synthèse" value={exam.synthesis} />
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
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
      <RichTextDisplay
        className="mt-1 text-sm"
        fallback="Non renseigné"
        value={value}
      />
    </div>
  );
}

function EntranceExamReadOnlyFields({ form }: { form: EntranceExamFormState }) {
  return (
    <div className="grid gap-3">
      <HistoryTextBlock
        label="Raison d'admission"
        value={form.admissionReason}
      />
      <HistoryTextBlock label="Mode de vie" value={form.lifestyle} />
      <HistoryTextBlock
        label="Traitement d'entrée"
        value={form.entranceTreatment}
      />
      <HistoryTextBlock
        label="Histoire de la maladie"
        value={form.diseaseHistory}
      />
      <HistoryTextBlock label="Examen d'entrée" value={form.clinicalExam} />
      <HistoryTextBlock label="Allergies" value={form.allergies} />
      <HistoryTextBlock label="Synthèse" value={form.synthesis} />
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

  if (category === "medical_history") {
    return "Ajouter un antécédent";
  }

  if (category === "surgery") {
    return "Ajouter une chirurgie";
  }

  return "Ajouter une entrée";
}

function AntecedentEditor({
  antecedent,
  canEdit,
  isEditing,
  isPending,
  onEdit,
  onChange,
  onRemove,
}: {
  antecedent: AntecedentFormState;
  canEdit: boolean;
  isEditing: boolean;
  isPending: boolean;
  onEdit: () => void;
  onChange: (patch: Partial<AntecedentFormState>) => void;
  onRemove: () => void;
}) {
  const isPathology = antecedent.category === "pathology";
  const editable = canEdit && (isPending || isEditing);
  const showActions = canEdit && !isPending;

  return (
    <div className="group/antecedent grid gap-3 rounded-2xl border bg-muted/20 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          {isPathology ? (
            editable ? (
              <ClinicalReferenceInput
                antecedent={antecedent}
                onChange={onChange}
              />
            ) : (
              <AntecedentReferenceDisplay antecedent={antecedent} />
            )
          ) : editable ? (
            <RichTextNoteField
              className="min-h-20"
              title={freeTextAntecedentInputLabel(antecedent.category)}
              placeholder={freeTextAntecedentPlaceholder(antecedent.category)}
              value={antecedent.label}
              onChange={(value) =>
                onChange({
                  code: "",
                  label: value,
                  referenceQuery: value,
                  source: "",
                })
              }
            />
          ) : (
            <AntecedentTextDisplay value={antecedent.label} />
          )}
        </div>
        {showActions && (
          <AntecedentActions
            canEdit={!isEditing}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        )}
      </div>

      {isPathology && (
        <>
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

          {editable ? (
            <RichTextNoteField
              className="min-h-20"
              title="Notes d'antécédent"
              placeholder="Notes"
              value={antecedent.notes}
              onChange={(value) => onChange({ notes: value })}
            />
          ) : antecedent.notes ? (
            <RichTextDisplay
              className="rounded-md border bg-muted/20 p-2 text-xs"
              value={antecedent.notes}
            />
          ) : null}
        </>
      )}

      {isPending && editable && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            aria-label="Annuler la création"
            className="flex-1"
            onClick={onRemove}
          >
            Annuler
          </Button>
          <Button
            className="flex-1"
            type="submit"
            variant="default"
            aria-label="Ajouter l'entrée"
            disabled={!richTextHasText(antecedent.label)}
          >
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
}

function AntecedentReferenceDisplay({
  antecedent,
}: {
  antecedent: AntecedentFormState;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">
        {antecedentReferenceLabel(antecedent)}
      </span>
    </div>
  );
}

function AntecedentTextDisplay({ value }: { value?: string | null }) {
  return (
    <div className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs">
      <RichTextDisplay fallback="Non renseigné" value={value} />
    </div>
  );
}

function AntecedentActions({
  canEdit,
  onEdit,
  onRemove,
}: {
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  function edit() {
    setOpen(false);
    onEdit();
  }

  function remove() {
    setOpen(false);
    onRemove();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Actions"
          className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover/antecedent:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        {canEdit && (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onClick={edit}
          >
            <Pencil className="size-4" />
            Modifier
          </button>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
          onClick={remove}
        >
          <Trash2 className="size-4" />
          Supprimer
        </button>
      </PopoverContent>
    </Popover>
  );
}

function antecedentReferenceLabel(antecedent: AntecedentFormState) {
  if (antecedent.referenceQuery.trim()) {
    return antecedent.referenceQuery;
  }

  if (antecedent.code && antecedent.label) {
    return `${antecedent.code} - ${antecedent.label}`;
  }

  return antecedent.label || "Non renseigné";
}

function freeTextAntecedentInputLabel(category: AntecedentCategory) {
  if (category === "surgery") {
    return "Chirurgie";
  }

  return "Antécédent médical";
}

function freeTextAntecedentPlaceholder(category: AntecedentCategory) {
  if (category === "surgery") {
    return "Saisir une chirurgie";
  }

  return "Saisir un antécédent médical";
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
  const kind: ClinicalReferenceKind = "pathology";
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
      <Popover open={showResults} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Rechercher une pathologie"
              className="pr-2.5 pl-8"
              placeholder="Rechercher une pathologie"
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
          <ScrollArea className="max-h-72 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
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
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function isAntecedentEditable(
  antecedent: AntecedentFormState,
  now = Date.now(),
) {
  if (!antecedent.createdAt) {
    return true;
  }

  const createdAt = Date.parse(antecedent.createdAt);

  if (Number.isNaN(createdAt)) {
    return false;
  }

  return now - createdAt <= ANTECEDENT_EDIT_WINDOW_MS;
}

function groupAntecedents(antecedents: AntecedentFormState[]) {
  const groups: Record<AntecedentCategory, AntecedentFormState[]> = {
    pathology: [],
    medical_history: [],
    surgery: [],
  };

  return antecedents.reduce((groups, antecedent) => {
    groups[antecedent.category].push(antecedent);
    return groups;
  }, groups);
}
