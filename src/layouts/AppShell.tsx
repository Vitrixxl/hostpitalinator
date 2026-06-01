import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
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
  useMatch,
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
import { AdminPanel } from "@/features/admin/components/AdminPanel"
import { PatientCreationPage } from "@/features/patients/components/PatientCreationPage"
import { PatientWorkspace } from "@/features/patients/components/PatientWorkspace"
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
  const patientRouteMatch = useMatch("/patients/:patientId/*")
  const selectedPatientId = patientRouteMatch?.params.patientId ?? null
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
    <main className="min-h-screen bg-background text-foreground">
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

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[360px_1fr]">
        <aside className="border-b bg-muted/20 p-4 lg:border-r lg:border-b-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-medium">
                  Base patients
                </h2>
                <p className="text-xs text-muted-foreground">
                  {patients.length} dossier{patients.length > 1 ? "s" : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => {
                  void loadPatients()
                  void loadBeds()
                }}
                aria-label="Actualiser les patients"
              >
                <RefreshCw
                  className={loadingPatients ? "size-4 animate-spin" : "size-4"}
                />
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nom, prenom, mail, telephone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              Inclure archives
            </label>

            {patientError && <AlertMessage message={patientError} />}

            <Button
              type="button"
              className="w-full justify-start"
              variant={activeView === "new-patient" ? "default" : "outline"}
              onClick={() => navigate("/patients/new")}
            >
              <Plus className="size-4" />
              Nouveau patient
            </Button>

            <div className="max-h-[42vh] space-y-2 overflow-auto pr-1 lg:max-h-[calc(100vh-20rem)]">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left text-sm transition hover:bg-muted ${
                    selectedPatientId === patient.id
                      ? "border-primary bg-primary/5"
                      : "bg-background"
                  }`}
                  onClick={() => navigate(`/patients/${patient.id}/summary`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {patient.lastName} {patient.firstName}
                    </span>
                    {patient.archivedAt && (
                      <Badge variant="outline">Archive</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {patient.sex && <span>{patientSexLabel(patient.sex)}</span>}
                    {patient.currentService && (
                      <span>{patient.currentService}</span>
                    )}
                    {patient.bedId && (
                      <span>Lit {bedLabel(beds, patient.bedId)}</span>
                    )}
                    {patient.phoneNumber && <span>{patient.phoneNumber}</span>}
                    {patient.email && <span>{patient.email}</span>}
                  </div>
                </button>
              ))}

              {!loadingPatients && patients.length === 0 && (
                <EmptyState label="Aucun patient trouve" />
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-4 lg:p-6">
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
                <EmptyState label="Selectionnez ou creez un dossier patient" />
              }
            />
            <Route path="*" element={<Navigate to="/patients" replace />} />
          </Routes>
        </section>
      </div>
    </main>
  )
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
