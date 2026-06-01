import { useCallback, useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowUpRight,
  CalendarClock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react"
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router"

import {
  createPatient,
  healthCheck,
  listBeds,
  listPatients,
  listServices,
} from "@/api"
import { ROLE_LABELS } from "@/app/constants"
import { formatDate, formatShortDateTime } from "@/app/date-utils"
import { errorMessage } from "@/app/error-utils"
import { emptyPatientForm } from "@/app/form-state"
import {
  bedLabel,
  optionalValue,
  patientSexLabel,
} from "@/app/formatters"
import type { PatientFormState } from "@/app/types"
import { AlertMessage, EmptyState } from "@/components/common/Feedback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminPanel } from "@/features/admin/components/AdminPanel"
import { PatientCreationPage } from "@/features/patients/components/PatientCreationPage"
import { PatientWorkspace } from "@/features/patients/components/PatientWorkspace"
import { cn } from "@/lib/utils"
import type { Account, Bed, Patient, PatientSex, Service } from "@/types"

type AppView = "patients" | "new-patient" | "admin"

export function AppShell({
  account,
  onLogout,
}: {
  account: Account
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeView: AppView = location.pathname.startsWith("/admin")
    ? "admin"
    : location.pathname.startsWith("/patients/new")
      ? "new-patient"
      : "patients"

  const [apiStatus, setApiStatus] = useState("verification")
  const [patients, setPatients] = useState<Patient[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [search, setSearch] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [patientError, setPatientError] = useState("")
  const [patientForm, setPatientForm] = useState<PatientFormState>(
    emptyPatientForm(account.service)
  )

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true)
    setPatientError("")

    try {
      setPatients(
        await listPatients({
          q: search,
          includeArchived,
        })
      )
    } catch (error) {
      setPatientError(errorMessage(error))
    } finally {
      setLoadingPatients(false)
    }
  }, [includeArchived, search])

  const loadBeds = useCallback(async () => {
    try {
      setBeds(await listBeds())
    } catch (error) {
      setPatientError(errorMessage(error))
    }
  }, [])

  const loadServices = useCallback(async () => {
    try {
      setServices(await listServices())
    } catch (error) {
      setPatientError(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus("connectee"))
      .catch(() => setApiStatus("indisponible"))
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPatients()
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [loadPatients])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBeds()
      void loadServices()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadBeds, loadServices])

  async function handleCreatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPatientError("")

    try {
      const created = await createPatient({
        firstName: patientForm.firstName,
        lastName: patientForm.lastName,
        birthDate: patientForm.birthDate,
        sex: optionalValue(patientForm.sex) as PatientSex | undefined,
        address: optionalValue(patientForm.address),
        apartmentNumber: optionalValue(patientForm.apartmentNumber),
        phoneNumber: optionalValue(patientForm.phoneNumber),
        email: optionalValue(patientForm.email),
        currentService: patientForm.currentService || account.service,
        administrativeInfo: optionalValue(patientForm.administrativeInfo),
        bedId: optionalValue(patientForm.bedId),
      })
      setPatientForm(emptyPatientForm(account.service))
      await Promise.all([loadPatients(), loadBeds()])
      navigate(`/patients/${created.id}/summary`)
    } catch (error) {
      setPatientError(errorMessage(error))
    }
  }

  function refreshPatientContext() {
    void loadPatients()
    void loadBeds()
    void loadServices()
  }

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-heading text-lg font-medium">
                Hospitalinator
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {account.name} · {ROLE_LABELS[account.role]} · API {apiStatus}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={activeView !== "admin" ? "default" : "outline"}
              onClick={() => navigate("/patients")}
            >
              <Users className="size-4" />
              Patients
            </Button>
            {account.role === "admin" && (
              <Button
                type="button"
                variant={activeView === "admin" ? "default" : "outline"}
                onClick={() => navigate("/admin")}
              >
                <UserCog className="size-4" />
                Administration
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onLogout}>
              <LogOut className="size-4" />
              Sortir
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary),transparent_86%),transparent_34rem)]">
        <section className="mx-auto min-w-0 max-w-7xl p-4 lg:p-8">
          <Routes>
            <Route index element={<Navigate to="/patients" replace />} />
            <Route
              path="/admin"
              element={
                account.role === "admin" ? (
                  <AdminPanel onCatalogChanged={refreshPatientContext} />
                ) : (
                  <Navigate to="/patients" replace />
                )
              }
            />
            <Route
              path="/patients/new"
              element={
                <PatientCreationPage
                  account={account}
                  beds={beds}
                  error={patientError}
                  form={patientForm}
                  services={services}
                  onCancel={() => navigate("/patients")}
                  onChange={setPatientForm}
                  onSubmit={handleCreatePatient}
                />
              }
            />
            <Route
              path="/patients/:patientId/:tab?"
              element={
                <PatientWorkspaceRoute
                  account={account}
                  beds={beds}
                  services={services}
                  onPatientChanged={refreshPatientContext}
                />
              }
            />
            <Route
              path="/patients"
              element={
                <PatientDirectory
                  beds={beds}
                  includeArchived={includeArchived}
                  loadingPatients={loadingPatients}
                  patientError={patientError}
                  patients={patients}
                  search={search}
                  onCreatePatient={() => navigate("/patients/new")}
                  onIncludeArchivedChange={setIncludeArchived}
                  onOpenPatient={(patientId) =>
                    navigate(`/patients/${patientId}/summary`)
                  }
                  onRefresh={() => {
                    void loadPatients()
                    void loadBeds()
                  }}
                  onSearchChange={setSearch}
                />
              }
            />
            <Route path="*" element={<Navigate to="/patients" replace />} />
          </Routes>
        </section>
      </div>
    </main>
  )
}

function PatientDirectory({
  beds,
  includeArchived,
  loadingPatients,
  patientError,
  patients,
  search,
  onCreatePatient,
  onIncludeArchivedChange,
  onOpenPatient,
  onRefresh,
  onSearchChange,
}: {
  beds: Bed[]
  includeArchived: boolean
  loadingPatients: boolean
  patientError: string
  patients: Patient[]
  search: string
  onCreatePatient: () => void
  onIncludeArchivedChange: (includeArchived: boolean) => void
  onOpenPatient: (patientId: string) => void
  onRefresh: () => void
  onSearchChange: (search: string) => void
}) {
  const recentPatients = useMemo(
    () =>
      [...patients].sort(
        (left, right) =>
          patientTimeValue(right.createdAt) - patientTimeValue(left.createdAt)
      ),
    [patients]
  )
  const activePatientCount = patients.filter(
    (patient) => !patient.archivedAt
  ).length

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border bg-card/90 p-4 shadow-[0_24px_80px_color-mix(in_oklch,var(--foreground),transparent_92%)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Base patients
              </p>
              <h1 className="mt-1 font-heading text-3xl font-medium text-balance">
                Arrivees recentes
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {activePatientCount} dossier
                {activePatientCount > 1 ? "s actifs" : " actif"} dans le
                perimetre courant.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onCreatePatient}>
              <Plus className="size-4" />
              Nouveau patient
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={onRefresh}
              aria-label="Actualiser les patients"
            >
              <RefreshCw
                className={cn("size-4", loadingPatients && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-14 rounded-[1.4rem] border-input/60 bg-background/80 pl-12 pr-4 text-base shadow-inner shadow-muted/60 focus-visible:ring-primary/20 md:text-base"
              placeholder="Rechercher par nom ou prenom"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <label className="flex h-11 items-center gap-2 rounded-full border bg-background/70 px-4 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={includeArchived}
              onChange={(event) =>
                onIncludeArchivedChange(event.target.checked)
              }
            />
            Inclure archives
          </label>
        </div>

        {patientError && (
          <div className="mt-4">
            <AlertMessage message={patientError} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] border bg-card shadow-[0_28px_90px_color-mix(in_oklch,var(--foreground),transparent_90%)]">
        <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background text-primary">
              <CalendarClock className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-medium">
                Patients les plus recents
              </h2>
              <p className="text-sm text-muted-foreground">
                Tries par date d'arrivee a l'hopital.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="h-7 px-3">
            {recentPatients.length} dossier
            {recentPatients.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {recentPatients.length > 0 ? (
          <Table>
            <TableHeader className="bg-background/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 pl-5 text-xs text-muted-foreground uppercase">
                  Patient
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase">
                  Arrivee
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase">
                  Service
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase">
                  Lit
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase">
                  Contact
                </TableHead>
                <TableHead className="text-xs text-muted-foreground uppercase">
                  Statut
                </TableHead>
                <TableHead className="pr-5 text-right text-xs text-muted-foreground uppercase">
                  Dossier
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPatients.map((patient) => (
                <PatientDirectoryRow
                  key={patient.id}
                  beds={beds}
                  patient={patient}
                  onOpenPatient={onOpenPatient}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState
              label={
                loadingPatients
                  ? "Chargement des patients"
                  : "Aucun patient trouve"
              }
            />
          </div>
        )}
      </section>
    </div>
  )
}

function PatientDirectoryRow({
  beds,
  patient,
  onOpenPatient,
}: {
  beds: Bed[]
  patient: Patient
  onOpenPatient: (patientId: string) => void
}) {
  const hasContact = Boolean(patient.phoneNumber || patient.email)

  return (
    <TableRow
      className="cursor-pointer bg-card/80 hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
      role="button"
      tabIndex={0}
      onClick={() => onOpenPatient(patient.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpenPatient(patient.id)
        }
      }}
    >
      <TableCell className="min-w-[270px] py-4 pl-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
            {patientInitials(patient)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {patient.lastName} {patient.firstName}
              </span>
              {patient.archivedAt && <Badge variant="outline">Archive</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ne(e) le {formatDate(patient.birthDate)} ·{" "}
              {patientSexLabel(patient.sex)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4">
        <div className="font-medium">{formatShortDateTime(patient.createdAt)}</div>
        <div className="text-xs text-muted-foreground">
          MAJ {formatShortDateTime(patient.updatedAt)}
        </div>
      </TableCell>
      <TableCell className="py-4">
        <Badge variant="secondary">{patient.currentService}</Badge>
      </TableCell>
      <TableCell className="py-4 text-sm">
        {patient.bedId ? bedLabel(beds, patient.bedId) : "Non assigne"}
      </TableCell>
      <TableCell className="max-w-[260px] whitespace-normal py-4 text-sm">
        {hasContact ? (
          <div className="space-y-1">
            {patient.phoneNumber && <div>{patient.phoneNumber}</div>}
            {patient.email && (
              <div className="truncate text-muted-foreground">
                {patient.email}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Non renseigne</span>
        )}
      </TableCell>
      <TableCell className="py-4">
        <Badge variant={patient.archivedAt ? "outline" : "default"}>
          {patient.archivedAt ? "Archive" : "Actif"}
        </Badge>
      </TableCell>
      <TableCell className="py-4 pr-5 text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onOpenPatient(patient.id)
          }}
        >
          Ouvrir
          <ArrowUpRight className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function patientInitials(patient: Patient) {
  return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`
    .trim()
    .toUpperCase()
}

function patientTimeValue(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function PatientWorkspaceRoute({
  account,
  beds,
  services,
  onPatientChanged,
}: {
  account: Account
  beds: Bed[]
  services: Service[]
  onPatientChanged: () => void
}) {
  const { patientId } = useParams()

  if (!patientId) {
    return <Navigate to="/patients" replace />
  }

  return (
    <PatientWorkspace
      key={patientId}
      patientId={patientId}
      currentAccount={account}
      beds={beds}
      services={services}
      onPatientChanged={onPatientChanged}
    />
  )
}
