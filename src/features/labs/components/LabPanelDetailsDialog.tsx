import { formatShortDateTime } from "@/app/date-utils"
import { StatusBadge } from "@/components/common/Feedback"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
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

            <div className="max-h-[60vh] overflow-auto rounded-3xl border">
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
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
