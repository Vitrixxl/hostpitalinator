import { formatShortDateTime } from "@/app/date-utils"
import { StatusBadge } from "@/components/common/Feedback"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LabPanel } from "@/types"

export function LabPanelDetailsDialog({
  panel,
  onOpenChange,
}: {
  panel: LabPanel | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={panel !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        {panel && (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{panel.panelType}</DialogTitle>
              <DialogDescription>
                Prélèvement du {formatShortDateTime(panel.sampledAt)} ·{" "}
                {panel.results.length} valeur
                {panel.results.length > 1 ? "s" : ""}
              </DialogDescription>
            </DialogHeader>

            {panel.note ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">
                  Note de demande
                </p>
                <p className="mt-1 whitespace-pre-wrap">{panel.note}</p>
              </div>
            ) : null}

            <ScrollArea className="max-h-[60vh] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marqueur</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panel.results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">
                        {result.markerLabel}
                      </TableCell>
                      <TableCell>
                        {result.value} {result.unit}
                      </TableCell>
                      <TableCell>{result.referenceInterval}</TableCell>
                      <TableCell>
                        <StatusBadge label={result.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {panel.results.length === 0 && (
                    <TableEmptyRow colSpan={4}>Aucun resultat</TableEmptyRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
