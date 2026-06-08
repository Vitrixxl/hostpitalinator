import type { Dispatch, FormEvent, SetStateAction } from "react"
import { Plus } from "lucide-react"

import { emptyLabForm } from "@/app/form-state"
import { labFormResult, labStatusLabel, updateLabFormResult } from "@/app/lab-utils"
import type { LabFormState } from "@/app/types"
import { DateTimeTextInput } from "@/components/common/DateInputs"
import { Field } from "@/components/common/Field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { LAB_PANEL_TYPES, LAB_RESULT_STATUSES, labPanelDefinition } from "@/types"
import type { LabPanel, LabPanelType, LabResultStatus } from "@/types"

type LabPanelDialogMode = "request" | "result"

export function LabPanelDialog({
  form,
  mode,
  open,
  onChange,
  onOpenChange,
  onSubmit,
  pendingPanel,
  lockPanelType = false,
}: {
  form: LabFormState
  mode: LabPanelDialogMode
  open: boolean
  onChange: Dispatch<SetStateAction<LabFormState>>
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pendingPanel?: LabPanel | null
  lockPanelType?: boolean
}) {
  const definition = labPanelDefinition(form.panelType)
  const isRequestMode = mode === "request"

  function updateResult(
    markerKey: string,
    patch: Parameters<typeof updateLabFormResult>[2]
  ) {
    onChange((current) => updateLabFormResult(current, markerKey, patch))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <form className="grid gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isRequestMode ? "Demander un bilan" : "Remplir un bilan"}
            </DialogTitle>
            <DialogDescription>
              {isRequestMode
                ? "Selectionnez le type de bilan a demander et ajoutez une note si besoin."
                : "Selectionnez le type de bilan puis renseignez les valeurs disponibles."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            {!isRequestMode && (
              <Field label="Date de prélèvement" required>
                <DateTimeTextInput
                  required
                  value={form.sampledAt}
                  onValueChange={(sampledAt) =>
                    onChange((current) => ({ ...current, sampledAt }))
                  }
                />
              </Field>
            )}
            <Field label="Type de bilan" required>
              <Select
                value={form.panelType}
                disabled={lockPanelType}
                onValueChange={(panelType) =>
                  onChange((current) =>
                    emptyLabForm(
                      panelType as LabPanelType,
                      current.sampledAt,
                      current.note
                    )
                  )
                }
              >
                <SelectTrigger className="max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAB_PANEL_TYPES.map((panelType) => (
                    <SelectItem key={panelType} value={panelType}>
                      {panelType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {isRequestMode ? (
            <Field label="Note" required={false}>
              <Textarea
                value={form.note}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </Field>
          ) : (
            <>
              {pendingPanel?.note ? (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">
                    Note de demande
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{pendingPanel.note}</p>
                </div>
              ) : null}
              <ScrollArea className="max-h-[58vh] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marqueur</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {definition.markers.map((marker) => {
                      const current = labFormResult(form, marker.key)

                      return (
                        <LabMarkerResultRow
                          key={marker.key}
                          marker={marker}
                          result={current}
                          onResultChange={updateResult}
                        />
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              {isRequestMode ? "Demander le bilan" : "Enregistrer le bilan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LabMarkerResultRow({
  marker,
  result,
  onResultChange,
}: {
  marker: ReturnType<typeof labPanelDefinition>["markers"][number]
  result: ReturnType<typeof labFormResult>
  onResultChange: (
    markerKey: string,
    patch: Parameters<typeof updateLabFormResult>[2]
  ) => void
}) {
  return (
    <TableRow>
      <TableCell className="min-w-44 font-medium">{marker.label}</TableCell>
      <TableCell className="min-w-40">
        <Input
          type={marker.valueType === "number" ? "number" : "text"}
          step={marker.valueType === "number" ? "any" : undefined}
          value={result.value}
          onChange={(event) =>
            onResultChange(marker.key, {
              value: event.target.value,
            })
          }
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {marker.unit || "-"}
      </TableCell>
      <TableCell className="min-w-36 text-muted-foreground">
        {marker.referenceInterval}
      </TableCell>
      <TableCell className="min-w-36">
        <Select
          value={result.status}
          onValueChange={(status) =>
            onResultChange(marker.key, {
              status: status as LabResultStatus,
            })
          }
        >
          <SelectTrigger className="max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAB_RESULT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {labStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  )
}
