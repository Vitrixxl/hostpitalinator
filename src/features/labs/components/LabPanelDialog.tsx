import type { FormEvent } from "react"
import { Plus } from "lucide-react"

import { LAB_STATUSES } from "@/app/constants"
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
import { LAB_PANEL_TYPES, labPanelDefinition } from "@/types"
import type { LabPanelType, LabStatus } from "@/types"

export function LabPanelDialog({
  form,
  open,
  onChange,
  onOpenChange,
  onSubmit,
}: {
  form: LabFormState
  open: boolean
  onChange: (form: LabFormState) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const definition = labPanelDefinition(form.panelType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <form className="grid gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nouveau bilan biologique</DialogTitle>
            <DialogDescription>
              Selectionnez un type de bilan puis renseignez les valeurs
              disponibles.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Date de prelevement">
              <DateTimeTextInput
                required
                value={form.sampledAt}
                onValueChange={(sampledAt) => onChange({ ...form, sampledAt })}
              />
            </Field>
            <Field label="Type de bilan">
              <Select
                value={form.panelType}
                onValueChange={(panelType) =>
                  onChange(
                    emptyLabForm(panelType as LabPanelType, form.sampledAt)
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

          <div className="max-h-[58vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marqueur</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Unite</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definition.markers.map((marker) => {
                  const current = labFormResult(form, marker.key)

                  return (
                    <TableRow key={marker.key}>
                      <TableCell className="min-w-44 font-medium">
                        {marker.label}
                      </TableCell>
                      <TableCell className="min-w-40">
                        <Input
                          type={marker.valueType === "number" ? "number" : "text"}
                          step={marker.valueType === "number" ? "any" : undefined}
                          value={current.value}
                          onChange={(event) =>
                            onChange(
                              updateLabFormResult(form, marker.key, {
                                value: event.target.value,
                              })
                            )
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
                          value={current.status}
                          onValueChange={(status) =>
                            onChange(
                              updateLabFormResult(form, marker.key, {
                                status: status as LabStatus,
                              })
                            )
                          }
                        >
                          <SelectTrigger className="max-w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LAB_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {labStatusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Ajouter le bilan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
