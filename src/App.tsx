import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Activity,
  Archive,
  Ban,
  BedIcon,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Trash2,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  FlaskConical,
  HeartPulse,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  UserCog,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react"
import { fr } from "date-fns/locale/fr"
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  addEvolutionNote,
  addLabResult,
  addMedicalDocument,
  addPrescription,
  addVitalRecord,
  archivePatient,
  assignRole,
  bootstrapAdmin,
  createBed,
  createAccount,
  createPatient,
  createService,
  deleteBed,
  deleteVitalRecord,
  deleteService,
  disableAccount,
  downloadMedicalDocument,
  getAccount,
  getCurrentAccount,
  getLatestVitalRecord,
  getPatient,
  healthCheck,
  listAccounts,
  listBeds,
  listEvolutionNotes,
  listLabResults,
  listMedicalDocuments,
  listPatients,
  listPrescriptions,
  listServices,
  listVitalRecords,
  login,
  logout,
  openMedicalDocument,
  resetAccountPassword,
  searchAddressSuggestions,
  searchMedicines,
  setRealtimeContext,
  subscribeRealtime,
  type AddressSuggestion,
  type RealtimeEvent,
  updateAccount,
  updateBed,
  updatePatient,
  updatePrescriptionStatus,
  updateService,
  updateVitalRecord,
} from "@/api"
import {
  ApiRequestError,
  clearApiAuthToken,
  getApiAuthToken,
} from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { LAB_PANEL_TYPES, LAB_STATUSES, labPanelDefinition } from "@/types"
import type {
  Account,
  Bed,
  EvolutionNote,
  LabPanel,
  LabPanelType,
  LabStatus,
  MedicalDocument,
  MedicalDocumentCategory,
  Medicine,
  Patient,
  PatientSex,
  Prescription,
  Service,
  UserRole,
  VitalRecord,
} from "@/types"

type AppView = "patients" | "new-patient" | "admin"
type PatientTab =
  | "summary"
  | "vitals"
  | "prescriptions"
  | "labs"
  | "documents"
  | "evolution"

type PatientFormState = {
  firstName: string
  lastName: string
  birthDate: string
  sex: string
  address: string
  apartmentNumber: string
  phoneNumber: string
  email: string
  currentService: string
  bedId: string
  administrativeInfo: string
}

type VitalFormState = {
  recordedAt: string
  temperature: string
  heartRate: string
  systolicBloodPressure: string
  diastolicBloodPressure: string
  oxygenSaturation: string
  weight: string
  diuresis: string
  lastStoolDate: string
}

type PrescriptionMedicationFormState = {
  medicineId: string
  medication: string
  medicationQuery: string
  dosage: string
  frequency: string
  route: string
}

type PrescriptionFormState = {
  medications: PrescriptionMedicationFormState[]
  startDate: string
  endDate: string
  status: string
}

type PrescriptionFilters = {
  medication: string
  prescriber: string
  route: string
  startDateFrom: string
  startDateTo: string
}

type LabFormState = {
  sampledAt: string
  panelType: LabPanelType
  results: Record<string, LabFormResultState>
}

type LabFormResultState = {
  value: string
  status: LabStatus
}

type LabMarkerRangeFilter = {
  min: string
  max: string
}

type DocumentFormState = {
  title: string
  category: MedicalDocumentCategory
  storagePath: string
}

type EvolutionFormState = {
  service: string
  visitId: string
  recordedAt: string
  content: string
}

type AccountFormState = {
  name: string
  email: string
  role: UserRole
  service: string
  invite: boolean
}

type ServiceFormState = {
  name: string
}

type BedFormState = {
  label: string
  service: string
  sortOrder: string
}

type VitalChartPoint = {
  label: string
  [key: string]: number | string | null
}

type VitalChartLine = {
  dataKey: string
  name: string
  stroke: string
  unit: string
  decimals: number
  labelPosition?: "top" | "bottom"
}

type VitalChartPanel = {
  id: string
  title: string
  latestValue: string
  emptyLabel: string
  data: VitalChartPoint[]
  lines: VitalChartLine[]
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  doctor: "Medecin",
  nurse: "Infirmier",
  secretary: "Secretaire",
}

const ACCOUNT_STATUS_LABELS: Record<Account["status"], string> = {
  active: "Actif",
  invited: "Invite",
  disabled: "Suspendu",
}

const DOCUMENT_CATEGORY_LABELS: Record<MedicalDocumentCategory, string> = {
  report: "Compte rendu",
  biology: "Biologie",
  imaging: "Imagerie",
  prescription: "Prescription",
  letter: "Courrier",
  administrative: "Administratif",
}

const DOCUMENT_CATEGORIES = Object.keys(
  DOCUMENT_CATEGORY_LABELS
) as MedicalDocumentCategory[]

const PATIENT_SEX_LABELS: Record<PatientSex, string> = {
  female: "Femme",
  male: "Homme",
}

const PATIENT_SEXES = Object.keys(PATIENT_SEX_LABELS) as PatientSex[]

const LAB_STATUS_LABELS: Record<LabStatus, string> = {
  normal: "Normal",
  alerte: "Alerte",
  critique: "Critique",
  "a verifier": "A verifier",
}

const PATIENT_TABS: Array<{
  value: PatientTab
  label: string
  icon: typeof Activity
}> = [
  { value: "summary", label: "Synthese", icon: Stethoscope },
  { value: "vitals", label: "Constantes", icon: HeartPulse },
  { value: "prescriptions", label: "Prescriptions", icon: ClipboardList },
  { value: "labs", label: "Biologie", icon: FlaskConical },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "evolution", label: "Evolution", icon: Activity },
]

const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "En pause",
  completed: "Terminee",
  stopped: "Arretee",
}

const PRESCRIPTION_STATUSES = Object.keys(PRESCRIPTION_STATUS_LABELS)
const UNASSIGNED_BED_VALUE = "__unassigned__"
const UNSELECTED_SERVICE_VALUE = "__service_unselected__"
const ADDRESS_QUERY_MIN_LENGTH = 3
const MEDICINE_QUERY_MIN_LENGTH = 2

function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [authChecked, setAuthChecked] = useState(() => !getApiAuthToken())
  const [authError, setAuthError] = useState("")

  useEffect(() => {
    if (!getApiAuthToken()) {
      return
    }

    getCurrentAccount()
      .then((result) => {
        setAccount(result.account)
      })
      .catch((error) => {
        clearApiAuthToken()
        setAuthError(errorMessage(error))
      })
      .finally(() => setAuthChecked(true))
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      clearApiAuthToken()
    } finally {
      setAccount(null)
    }
  }

  if (!authChecked) {
    return <LoadingScreen label="Ouverture du dossier hospitalier" />
  }

  if (!account) {
    return <AuthScreen initialError={authError} onAuthenticated={setAccount} />
  }

  return <AppShell account={account} onLogout={handleLogout} />
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-xs">
        <RefreshCw className="size-4 animate-spin text-primary" />
        {label}
      </div>
    </main>
  )
}

function AuthScreen({
  initialError,
  onAuthenticated,
}: {
  initialError: string
  onAuthenticated: (account: Account) => void
}) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login")
  const [loginForm, setLoginForm] = useState({ email: "", password: "" })
  const [bootstrapForm, setBootstrapForm] = useState({
    name: "",
    email: "",
    service: "",
  })
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [message, setMessage] = useState(initialError)
  const [busy, setBusy] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")

    try {
      const session = await login(loginForm.email, loginForm.password)
      onAuthenticated(session.account)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    setGeneratedPassword("")

    try {
      const result = await bootstrapAdmin({
        name: bootstrapForm.name,
        email: bootstrapForm.email,
        service: bootstrapForm.service,
      })
      setGeneratedPassword(result.generatedPassword)
      setLoginForm({
        email: result.account.email,
        password: result.generatedPassword,
      })
      setMode("login")
      setMessage("Compte administrateur cree. Le mot de passe est pret.")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <Card className="w-full rounded-lg">
          <CardHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Hospitalinator
                </p>
                <CardTitle>Connexion</CardTitle>
              </div>
            </div>
            <CardDescription>
              Identifiez-vous pour acceder aux dossiers patients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                onClick={() => setMode("login")}
              >
                <ShieldCheck className="size-4" />
                Connexion
              </Button>
              <Button
                type="button"
                variant={mode === "bootstrap" ? "default" : "outline"}
                onClick={() => setMode("bootstrap")}
              >
                <UserPlus className="size-4" />
                Initialisation
              </Button>
            </div>

            {message && <AlertMessage message={message} />}
            {generatedPassword && (
              <AlertMessage
                tone="success"
                message={`Mot de passe initial: ${generatedPassword}`}
              />
            )}

            {mode === "login" ? (
              <form className="grid gap-4" onSubmit={handleLogin}>
                <Field label="Courriel">
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Mot de passe">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Se connecter
                </Button>
              </form>
            ) : (
              <form className="grid gap-4" onSubmit={handleBootstrap}>
                <Field label="Nom">
                  <Input
                    required
                    value={bootstrapForm.name}
                    onChange={(event) =>
                      setBootstrapForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Courriel">
                  <Input
                    type="email"
                    required
                    value={bootstrapForm.email}
                    onChange={(event) =>
                      setBootstrapForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Service initial">
                  <Input
                    required
                    value={bootstrapForm.service}
                    onChange={(event) =>
                      setBootstrapForm((current) => ({
                        ...current,
                        service: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Creer le premier administrateur
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function AppShell({
  account,
  onLogout,
}: {
  account: Account
  onLogout: () => void
}) {
  const [activeView, setActiveView] = useState<AppView>("patients")
  const [apiStatus, setApiStatus] = useState("verification")
  const [patients, setPatients] = useState<Patient[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null
  )
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
      const result = await listPatients({
        q: search,
        includeArchived,
      })
      setPatients(result)
      setSelectedPatientId((current) => {
        if (current && result.some((patient) => patient.id === current)) {
          return current
        }

        return result[0]?.id ?? null
      })
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
      setActiveView("patients")
      setSelectedPatientId(created.id)
      await Promise.all([loadPatients(), loadBeds()])
    } catch (error) {
      setPatientError(errorMessage(error))
    }
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
              onClick={() => setActiveView("patients")}
            >
              <Users className="size-4" />
              Patients
            </Button>
            {account.role === "admin" && (
              <Button
                type="button"
                variant={activeView === "admin" ? "default" : "outline"}
                onClick={() => setActiveView("admin")}
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
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
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
              onClick={() => {
                setActiveView("new-patient")
                setSelectedPatientId(null)
              }}
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
                  onClick={() => {
                    setActiveView("patients")
                    setSelectedPatientId(patient.id)
                  }}
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
          {activeView === "admin" && account.role === "admin" ? (
            <AdminPanel
              onCatalogChanged={() => {
                void loadBeds()
                void loadServices()
              }}
            />
          ) : activeView === "new-patient" ? (
            <PatientCreationPage
              account={account}
              beds={beds}
              error={patientError}
              form={patientForm}
              services={services}
              onCancel={() => setActiveView("patients")}
              onChange={setPatientForm}
              onSubmit={handleCreatePatient}
            />
          ) : selectedPatientId ? (
            <PatientWorkspace
              key={selectedPatientId}
              patientId={selectedPatientId}
              currentAccount={account}
              beds={beds}
              services={services}
              onPatientChanged={() => {
                void loadPatients()
                void loadBeds()
                void loadServices()
              }}
            />
          ) : (
            <EmptyState label="Selectionnez ou creez un dossier patient" />
          )}
        </section>
      </div>
    </main>
  )
}

function PatientCreationPage({
  account,
  beds,
  error,
  form,
  services,
  onCancel,
  onChange,
  onSubmit,
}: {
  account: Account
  beds: Bed[]
  error: string
  form: PatientFormState
  services: Service[]
  onCancel: () => void
  onChange: (form: PatientFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-medium">
            Creation d'un nouveau patient
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identite, coordonnees et affectation initiale.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>

      {error && <AlertMessage message={error} />}

      <form className="space-y-4" onSubmit={onSubmit}>
        <section className="rounded-lg border bg-background p-4">
          <SectionTitle icon={UserPlus} title="Donnees administratives" />
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
            Creer le dossier
          </Button>
        </div>
      </form>
    </div>
  )
}

function PatientFormFields({
  account,
  administrativeRequired = false,
  beds,
  currentPatientId,
  form,
  services,
  onChange,
}: {
  account: Account
  administrativeRequired?: boolean
  beds: Bed[]
  currentPatientId?: string
  form: PatientFormState
  services: Service[]
  onChange: (form: PatientFormState) => void
}) {
  function updateField(field: keyof PatientFormState, value: string) {
    onChange({ ...form, [field]: value })
  }

  const addressInputId = useId()

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Prenom">
          <Input
            required
            value={form.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
          />
        </Field>
        <Field label="Nom">
          <Input
            required
            value={form.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
          />
        </Field>
        <Field label="Date de naissance">
          <DateTextInput
            required
            value={form.birthDate}
            onValueChange={(birthDate) => updateField("birthDate", birthDate)}
          />
        </Field>
        <Field label="Sexe">
          <SexSelect
            required={administrativeRequired}
            value={form.sex}
            onChange={(sex) => updateField("sex", sex)}
          />
        </Field>
        <Field label="Service">
          <ServiceSelect
            services={services}
            required
            value={form.currentService}
            onChange={(currentService) =>
              onChange({ ...form, currentService, bedId: "" })
            }
            disabled={account.role !== "admin"}
          />
        </Field>
        <Field label="Lit">
          <BedSelect
            beds={beds}
            service={form.currentService || account.service}
            currentPatientId={currentPatientId}
            value={form.bedId}
            onChange={(bedId) => updateField("bedId", bedId)}
          />
        </Field>
        <div className="grid gap-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="grid gap-1.5">
            <Label htmlFor={addressInputId}>Adresse</Label>
            <AddressAutocomplete
              id={addressInputId}
              required={administrativeRequired}
              value={form.address}
              onChange={(address) => updateField("address", address)}
            />
          </div>
          <Field label="Appartement">
            <Input
              placeholder="Optionnel"
              value={form.apartmentNumber}
              onChange={(event) =>
                updateField("apartmentNumber", event.target.value)
              }
            />
          </Field>
        </div>
        <Field label="Telephone">
          <Input
            required={administrativeRequired}
            type="tel"
            value={form.phoneNumber}
            onChange={(event) => updateField("phoneNumber", event.target.value)}
          />
        </Field>
        <Field label="Courriel">
          <Input
            required={administrativeRequired}
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </Field>
      </div>

      <Field label="Informations administratives">
        <Textarea
          className="min-h-28"
          value={form.administrativeInfo}
          onChange={(event) =>
            updateField("administrativeInfo", event.target.value)
          }
        />
      </Field>
    </div>
  )
}

function PatientWorkspace({
  patientId,
  currentAccount,
  beds,
  services,
  onPatientChanged,
}: {
  patientId: string
  currentAccount: Account
  beds: Bed[]
  services: Service[]
  onPatientChanged: () => void
}) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [latestVital, setLatestVital] = useState<VitalRecord | null>(null)
  const [vitals, setVitals] = useState<VitalRecord[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [labs, setLabs] = useState<LabPanel[]>([])
  const [documents, setDocuments] = useState<MedicalDocument[]>([])
  const [notes, setNotes] = useState<EvolutionNote[]>([])
  const [selectedLabPanel, setSelectedLabPanel] = useState<LabPanel | null>(
    null
  )
  const [selectedEvolutionNote, setSelectedEvolutionNote] =
    useState<EvolutionNote | null>(null)
  const [evolutionDialogOpen, setEvolutionDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<PatientTab>("summary")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [documentFilter, setDocumentFilter] = useState<
    MedicalDocumentCategory | "all"
  >("all")
  const [labPanelFilter, setLabPanelFilter] = useState<LabPanelType | "all">(
    "all"
  )
  const [labStatusFilter, setLabStatusFilter] = useState("all")
  const [labMarkerFilters, setLabMarkerFilters] = useState<
    Record<string, LabMarkerRangeFilter>
  >({})
  const [prescriptionFilters, setPrescriptionFilters] =
    useState<PrescriptionFilters>(emptyPrescriptionFilters())
  const [patientForm, setPatientForm] = useState<PatientFormState>(
    emptyPatientForm()
  )
  const [vitalForm, setVitalForm] = useState<VitalFormState>(emptyVitalForm())
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null)
  const [vitalDialogOpen, setVitalDialogOpen] = useState(false)
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false)
  const [prescriptionForm, setPrescriptionForm] =
    useState<PrescriptionFormState>(emptyPrescriptionForm())
  const [labForm, setLabForm] = useState<LabFormState>(emptyLabForm())
  const [labDialogOpen, setLabDialogOpen] = useState(false)
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(
    emptyDocumentForm()
  )
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentFileKey, setDocumentFileKey] = useState(0)
  const [documentOpenPath, setDocumentOpenPath] = useState("")
  const [evolutionForm, setEvolutionForm] = useState<EvolutionFormState>(
    emptyEvolutionForm(currentAccount)
  )

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const [
        patientResult,
        latestVitalResult,
        vitalResults,
        prescriptionResults,
        labResults,
        documentResults,
        noteResults,
      ] = await Promise.all([
        getPatient(patientId),
        getLatestVitalRecord(patientId),
        listVitalRecords(patientId),
        listPrescriptions(patientId),
        listLabResults(patientId),
        listMedicalDocuments(
          patientId,
          documentFilter === "all" ? {} : { category: documentFilter }
        ),
        listEvolutionNotes(patientId),
      ])

      setPatient(patientResult)
      setPatientForm(patientToForm(patientResult))
      setLatestVital(latestVitalResult)
      setVitals(vitalResults)
      setPrescriptions(prescriptionResults)
      setLabs(labResults)
      setDocuments(documentResults)
      setNotes(noteResults)
      setEvolutionForm((current) => ({
        ...current,
        service: patientResult.currentService || currentAccount.service,
      }))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [currentAccount.service, documentFilter, patientId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadWorkspace()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadWorkspace])

  const refreshPatient = useCallback(async () => {
    try {
      const patientResult = await getPatient(patientId)

      setPatient(patientResult)
      setPatientForm(patientToForm(patientResult))
      onPatientChanged()
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    }
  }, [onPatientChanged, patientId])

  const refreshVitals = useCallback(async () => {
    try {
      const [latestVitalResult, vitalResults] = await Promise.all([
        getLatestVitalRecord(patientId),
        listVitalRecords(patientId),
      ])

      setLatestVital(latestVitalResult)
      setVitals(vitalResults)
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    }
  }, [patientId])

  const refreshPrescriptions = useCallback(async () => {
    try {
      setPrescriptions(await listPrescriptions(patientId))
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    }
  }, [patientId])

  const refreshLabs = useCallback(async () => {
    try {
      setLabs(await listLabResults(patientId))
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    }
  }, [patientId])

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(
        await listMedicalDocuments(
          patientId,
          documentFilter === "all" ? {} : { category: documentFilter }
        )
      )
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    }
  }, [documentFilter, patientId])

  const refreshEvolutionNotes = useCallback(async () => {
    try {
      setNotes(await listEvolutionNotes(patientId))
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    }
  }, [patientId])

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.patientId !== patientId) {
        return
      }

      if (event.entity === "patient") {
        void refreshPatient()
      } else if (event.entity === "vitalRecord") {
        void refreshVitals()
      } else if (event.entity === "prescription") {
        void refreshPrescriptions()
      } else if (event.entity === "labPanel") {
        void refreshLabs()
      } else if (event.entity === "medicalDocument") {
        void refreshDocuments()
      } else if (event.entity === "evolutionNote") {
        void refreshEvolutionNotes()
      }
    },
    [
      patientId,
      refreshDocuments,
      refreshEvolutionNotes,
      refreshLabs,
      refreshPatient,
      refreshPrescriptions,
      refreshVitals,
    ]
  )

  useEffect(() => {
    setRealtimeContext({
      patientId,
      page: realtimePageForPatientTab(activeTab),
    })

    return subscribeRealtime(handleRealtimeEvent)
  }, [activeTab, handleRealtimeEvent, patientId])

  const vitalChartData = useMemo(
    () =>
      [...vitals].reverse().map((record) => ({
        label: formatShortDateTime(record.recordedAt),
        temperature: record.temperature,
        heartRate: record.heartRate,
        systolicBloodPressure: record.systolicBloodPressure,
        diastolicBloodPressure: record.diastolicBloodPressure,
        oxygenSaturation: record.oxygenSaturation,
        weight: record.weight,
        diuresis: record.diuresis ?? null,
      })),
    [vitals]
  )

  const vitalChartPanels = useMemo<VitalChartPanel[]>(
    () => [
      {
        id: "temperature",
        title: "Temperature",
        latestValue: latestVital
          ? `${latestVital.temperature.toFixed(1)} C`
          : "Non renseignee",
        emptyLabel: "Aucune temperature renseignee",
        data: vitalChartData.map((point) => ({
          label: point.label,
          value: point.temperature,
        })),
        lines: [
          {
            dataKey: "value",
            name: "Temperature",
            stroke: "var(--chart-4)",
            unit: "C",
            decimals: 1,
          },
        ],
      },
      {
        id: "heart-rate",
        title: "Frequence cardiaque",
        latestValue: latestVital ? `${latestVital.heartRate} bpm` : "Non renseignee",
        emptyLabel: "Aucune frequence renseignee",
        data: vitalChartData.map((point) => ({
          label: point.label,
          value: point.heartRate,
        })),
        lines: [
          {
            dataKey: "value",
            name: "FC",
            stroke: "var(--chart-2)",
            unit: "bpm",
            decimals: 0,
          },
        ],
      },
      {
        id: "blood-pressure",
        title: "Tension arterielle",
        latestValue: latestVital
          ? `${latestVital.systolicBloodPressure}/${latestVital.diastolicBloodPressure} mmHg`
          : "Non renseignee",
        emptyLabel: "Aucune tension renseignee",
        data: vitalChartData.map((point) => ({
          label: point.label,
          systolic: point.systolicBloodPressure,
          diastolic: point.diastolicBloodPressure,
        })),
        lines: [
          {
            dataKey: "systolic",
            name: "Systolique",
            stroke: "var(--chart-3)",
            unit: "mmHg",
            decimals: 0,
            labelPosition: "top",
          },
          {
            dataKey: "diastolic",
            name: "Diastolique",
            stroke: "var(--chart-5)",
            unit: "mmHg",
            decimals: 0,
            labelPosition: "bottom",
          },
        ],
      },
      {
        id: "oxygen-saturation",
        title: "SpO2",
        latestValue: latestVital
          ? `${latestVital.oxygenSaturation.toFixed(0)} %`
          : "Non renseignee",
        emptyLabel: "Aucune SpO2 renseignee",
        data: vitalChartData.map((point) => ({
          label: point.label,
          value: point.oxygenSaturation,
        })),
        lines: [
          {
            dataKey: "value",
            name: "SpO2",
            stroke: "var(--chart-1)",
            unit: "%",
            decimals: 0,
          },
        ],
      },
      {
        id: "weight",
        title: "Poids",
        latestValue: latestVital
          ? `${latestVital.weight.toFixed(1)} kg`
          : "Non renseigne",
        emptyLabel: "Aucun poids renseigne",
        data: vitalChartData.map((point) => ({
          label: point.label,
          value: point.weight,
        })),
        lines: [
          {
            dataKey: "value",
            name: "Poids",
            stroke: "var(--chart-3)",
            unit: "kg",
            decimals: 1,
          },
        ],
      },
      {
        id: "diuresis",
        title: "Diurese",
        latestValue:
          latestVital?.diuresis != null
            ? `${latestVital.diuresis} ml`
            : "Non renseignee",
        emptyLabel: "Aucune diurese renseignee",
        data: vitalChartData.map((point) => ({
          label: point.label,
          value: point.diuresis,
        })),
        lines: [
          {
            dataKey: "value",
            name: "Diurese",
            stroke: "var(--chart-2)",
            unit: "ml",
            decimals: 0,
          },
        ],
      },
    ],
    [latestVital, vitalChartData]
  )

  const filteredLabs = useMemo(() => {
    const activeMarkerFilters =
      labPanelFilter === "all"
        ? []
        : labPanelDefinition(labPanelFilter).markers
            .map((marker) => ({
              markerKey: marker.key,
              filter: labMarkerFilters[marker.key],
            }))
            .filter(
              (
                item
              ): item is { markerKey: string; filter: LabMarkerRangeFilter } =>
                hasLabMarkerRangeFilter(item.filter)
            )

    return labs.filter((panel) => {
      if (labPanelFilter !== "all" && panel.panelType !== labPanelFilter) {
        return false
      }

      if (labStatusFilter !== "all" && panel.status !== labStatusFilter) {
        return false
      }

      if (activeMarkerFilters.length > 0) {
        return activeMarkerFilters.every(({ markerKey, filter }) => {
          const result = panel.results.find(
            (panelResult) => panelResult.markerKey === markerKey
          )

          if (!result) {
            return false
          }

          const resultValue = parseLabNumericValue(result.value)

          if (resultValue == null) {
            return false
          }

          const minimumValue = parseOptionalNumberFilter(filter.min)
          const maximumValue = parseOptionalNumberFilter(filter.max)

          if (minimumValue != null && resultValue < minimumValue) {
            return false
          }

          if (maximumValue != null && resultValue > maximumValue) {
            return false
          }

          return true
        })
      }

      return true
    })
  }, [labMarkerFilters, labPanelFilter, labStatusFilter, labs])

  const filteredPrescriptions = useMemo(
    () =>
      prescriptions.filter((prescription) => {
        if (
          !textIncludes(prescription.medication, prescriptionFilters.medication)
        ) {
          return false
        }

        if (!textIncludes(prescription.prescriber, prescriptionFilters.prescriber)) {
          return false
        }

        if (!textIncludes(prescription.route, prescriptionFilters.route)) {
          return false
        }

        const prescriptionStartDate = dateInput(prescription.startDate)

        if (
          prescriptionFilters.startDateFrom &&
          prescriptionStartDate < prescriptionFilters.startDateFrom
        ) {
          return false
        }

        if (
          prescriptionFilters.startDateTo &&
          prescriptionStartDate > prescriptionFilters.startDateTo
        ) {
          return false
        }

        return true
      }),
    [prescriptionFilters, prescriptions]
  )

  const hasPrescriptionFilters = useMemo(
    () =>
      Object.values(prescriptionFilters).some(
        (filterValue) => filterValue.trim() !== ""
      ),
    [prescriptionFilters]
  )

  async function runAction(action: () => Promise<void>, okMessage: string) {
    setError("")
    setSuccess("")

    try {
      await action()
      setSuccess(okMessage)
    } catch (actionError) {
      setError(errorMessage(actionError))
    }
  }

  async function handleUpdatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAction(async () => {
      const updated = await updatePatient(patientId, {
        firstName: patientForm.firstName,
        lastName: patientForm.lastName,
        birthDate: patientForm.birthDate,
        sex: nullableOptionalValue(patientForm.sex) as PatientSex | null,
        address: nullableOptionalValue(patientForm.address),
        apartmentNumber: nullableOptionalValue(patientForm.apartmentNumber),
        phoneNumber: nullableOptionalValue(patientForm.phoneNumber),
        email: nullableOptionalValue(patientForm.email),
        currentService: patientForm.currentService,
        administrativeInfo: nullableOptionalValue(patientForm.administrativeInfo),
        bedId: nullableOptionalValue(patientForm.bedId),
      })
      setPatient(updated)
      setPatientForm(patientToForm(updated))
      onPatientChanged()
    }, "Dossier patient enregistre")
  }

  async function handleArchivePatient() {
    await runAction(async () => {
      const archived = await archivePatient(patientId)
      setPatient(archived)
      onPatientChanged()
    }, "Dossier archive")
  }

  async function handleSubmitVital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAction(async () => {
      if (editingVitalId) {
        await updateVitalRecord(
          patientId,
          editingVitalId,
          vitalFormToInput(vitalForm)
        )
      } else {
        await addVitalRecord(patientId, vitalFormToInput(vitalForm))
      }

      setEditingVitalId(null)
      setVitalDialogOpen(false)
      setVitalForm(emptyVitalForm())
      await loadWorkspace()
    }, editingVitalId ? "Constantes modifiees" : "Constantes ajoutees")
  }

  function handleOpenNewVitalDialog() {
    if (editingVitalId) {
      setEditingVitalId(null)
      setVitalForm(emptyVitalForm())
    }

    setVitalDialogOpen(true)
  }

  function handleEditVital(record: VitalRecord) {
    if (editingVitalId !== record.id) {
      setEditingVitalId(record.id)
      setVitalForm(vitalRecordToForm(record))
    }

    setVitalDialogOpen(true)
  }

  function handleCancelVitalEdit() {
    setVitalDialogOpen(false)
  }

  async function handleDeleteVital(record: VitalRecord) {
    const confirmed = window.confirm(
      `Supprimer la mesure du ${formatShortDateTime(record.recordedAt)} ?`
    )

    if (!confirmed) {
      return
    }

    await runAction(async () => {
      await deleteVitalRecord(patientId, record.id)

      if (editingVitalId === record.id) {
        setEditingVitalId(null)
        setVitalDialogOpen(false)
        setVitalForm(emptyVitalForm())
      }

      await loadWorkspace()
    }, "Mesure supprimee")
  }

  async function handleAddPrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAction(
      async () => {
        const medicationInputs = prescriptionForm.medications.map(
          trimPrescriptionMedicationForm
        )

        if (
          medicationInputs.some(
            (medication) =>
              !medication.medicineId ||
              !medication.dosage ||
              !medication.frequency ||
              !medication.route
          )
        ) {
          throw new Error("Selectionnez un medicament reference pour chaque ligne")
        }

        await Promise.all(
          medicationInputs.map((medication) =>
            addPrescription(patientId, {
              medicineId: medication.medicineId,
              dosage: medication.dosage,
              frequency: medication.frequency,
              route: medication.route,
              startDate: prescriptionForm.startDate,
              endDate: optionalValue(prescriptionForm.endDate),
              status: prescriptionForm.status,
            })
          )
        )

        setPrescriptionForm(emptyPrescriptionForm())
        setPrescriptionDialogOpen(false)
        await loadWorkspace()
      },
      prescriptionForm.medications.length > 1
        ? "Prescriptions ajoutees"
        : "Prescription ajoutee"
    )
  }

  function handleOpenPrescriptionDialog() {
    setPrescriptionForm(emptyPrescriptionForm())
    setPrescriptionDialogOpen(true)
  }

  async function handlePrescriptionStatus(
    prescriptionId: string,
    status: string
  ) {
    await runAction(async () => {
      await updatePrescriptionStatus(prescriptionId, status)
      await loadWorkspace()
    }, "Statut modifie")
  }

  async function handleAddLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAction(async () => {
      const results = labFormResultsToInput(labForm)

      if (results.length === 0) {
        throw new Error("Renseignez au moins une valeur biologique")
      }

      await addLabResult(patientId, {
        sampledAt: labForm.sampledAt,
        panelType: labForm.panelType,
        status: worstLabStatus(results.map((result) => result.status)),
        results,
      })
      setLabForm(emptyLabForm())
      setLabDialogOpen(false)
      await loadWorkspace()
    }, "Bilan biologique ajoute")
  }

  function handleOpenLabDialog() {
    setLabForm(emptyLabForm())
    setLabDialogOpen(true)
  }

  function updateLabMarkerFilter(
    markerKey: string,
    patch: Partial<LabMarkerRangeFilter>
  ) {
    setLabMarkerFilters((current) => ({
      ...current,
      [markerKey]: {
        ...emptyLabMarkerRangeFilter(),
        ...current[markerKey],
        ...patch,
      },
    }))
  }

  function clearLabMarkerFilter(markerKey: string) {
    setLabMarkerFilters((current) => {
      const remainingFilters = { ...current }
      delete remainingFilters[markerKey]
      return remainingFilters
    })
  }

  async function handleAddDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAction(async () => {
      const filePayload = documentFile
        ? {
            contentBase64: await readFileAsDataUrl(documentFile),
            originalFileName: documentFile.name,
            mimeType: documentFile.type || "application/octet-stream",
          }
        : {}

      await addMedicalDocument(patientId, {
        title: documentForm.title,
        category: documentForm.category,
        storagePath: optionalValue(documentForm.storagePath),
        ...filePayload,
      })
      setDocumentForm(emptyDocumentForm())
      setDocumentFile(null)
      setDocumentFileKey((current) => current + 1)
      await loadWorkspace()
    }, "Document ajoute")
  }

  async function handleOpenDocument(documentId: string) {
    await runAction(async () => {
      const result = await openMedicalDocument(documentId)
      setDocumentOpenPath(result.storagePath ?? "Aucun chemin de stockage")
    }, "Reference document chargee")
  }

  async function handleDownloadDocument(document: MedicalDocument) {
    await runAction(async () => {
      const response = await downloadMedicalDocument(document.id)

      if (!response.ok) {
        throw new Error(`Telechargement refuse (${response.status})`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement("a")
      anchor.href = url
      anchor.download =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ||
        document.originalFileName ||
        `${document.title}.bin`
      anchor.click()
      URL.revokeObjectURL(url)
    }, "Telechargement lance")
  }

  async function handleAddEvolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAction(async () => {
      await addEvolutionNote(patientId, {
        service: evolutionForm.service,
        visitId: evolutionForm.visitId,
        author: currentAccount.name,
        recordedAt: evolutionForm.recordedAt,
        content: evolutionForm.content,
      })
      setEvolutionForm((current) => ({
        ...emptyEvolutionForm(currentAccount),
        service: patient?.currentService ?? current.service,
      }))
      setEvolutionDialogOpen(false)
      await loadWorkspace()
    }, "Note d'evolution ajoutee")
  }

  function handleOpenEvolutionDialog() {
    setEvolutionForm((current) => ({
      ...emptyEvolutionForm(currentAccount),
      service: patient?.currentService ?? current.service,
    }))
    setEvolutionDialogOpen(true)
  }

  if (loading && !patient) {
    return <LoadingScreen label="Chargement du dossier patient" />
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        {error && <AlertMessage message={error} />}
        <EmptyState label="Dossier patient introuvable" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl font-medium">
              {patient.lastName} {patient.firstName}
            </h2>
            {patient.archivedAt ? (
              <Badge variant="outline">Archive</Badge>
            ) : (
              <Badge variant="secondary">Actif</Badge>
            )}
          </div>
          <div className="mt-3 flex max-w-3xl flex-wrap gap-2">
            <PatientInfoBadge>{`Ne(e) le ${formatDate(patient.birthDate)}`}</PatientInfoBadge>
            {patient.phoneNumber && (
              <PatientInfoBadge>{`Tel ${patient.phoneNumber}`}</PatientInfoBadge>
            )}
            {patient.email && <PatientInfoBadge>{patient.email}</PatientInfoBadge>}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
          <MetricTile label="Sexe" value={patientSexLabel(patient.sex)} />
          <MetricTile label="Lit" value={bedLabel(beds, patient.bedId)} />
          <MetricTile
            label="Constantes"
            value={latestVital ? formatShortDateTime(latestVital.recordedAt) : "Aucune"}
          />
          <MetricTile
            label="Prescriptions"
            value={`${prescriptions.length}`}
          />
          <MetricTile label="Documents" value={`${documents.length}`} />
        </div>
      </div>

      {error && <AlertMessage message={error} />}
      {success && <AlertMessage tone="success" message={success} />}
      {documentOpenPath && (
        <AlertMessage tone="success" message={`Reference: ${documentOpenPath}`} />
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PatientTab)}
        className="gap-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          {PATIENT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary">
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <form
              className="grid gap-4 rounded-lg border bg-background p-4"
              onSubmit={handleUpdatePatient}
            >
              <SectionTitle
                icon={Stethoscope}
                title="Synthese administrative"
                action={
                  <Button type="submit">
                    <Save className="size-4" />
                    Enregistrer
                  </Button>
                }
              />
              <PatientFormFields
                account={currentAccount}
                beds={beds}
                currentPatientId={patient.id}
                form={patientForm}
                services={services}
                onChange={setPatientForm}
              />
            </form>

            <section className="space-y-4 rounded-lg border bg-background p-4">
              <SectionTitle icon={Activity} title="Dernieres donnees" />
              <div className="grid gap-3 sm:grid-cols-2">
                <ClinicalValue
                  label="Temperature"
                  value={
                    latestVital
                      ? `${latestVital.temperature.toFixed(1)} C`
                      : "Non renseignee"
                  }
                />
                <ClinicalValue
                  label="Frequence cardiaque"
                  value={
                    latestVital ? `${latestVital.heartRate} bpm` : "Non renseignee"
                  }
                />
                <ClinicalValue
                  label="Tension"
                  value={
                    latestVital
                      ? `${latestVital.systolicBloodPressure}/${latestVital.diastolicBloodPressure}`
                      : "Non renseignee"
                  }
                />
                <ClinicalValue
                  label="SpO2"
                  value={
                    latestVital
                      ? `${latestVital.oxygenSaturation.toFixed(0)} %`
                      : "Non renseignee"
                  }
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleArchivePatient()}
                disabled={Boolean(patient.archivedAt)}
              >
                <Archive className="size-4" />
                Archiver le dossier
              </Button>
            </section>
          </section>
        </TabsContent>

        <TabsContent value="vitals">
          <section className="space-y-4">
            <SectionTitle
              icon={Thermometer}
              title="Constantes vitales"
              action={
                <Button type="button" onClick={handleOpenNewVitalDialog}>
                  <Plus className="size-4" />
                  Nouvelle mesure
                </Button>
              }
            />
            <div>
              {vitalChartData.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {vitalChartPanels.map((panel) => (
                    <VitalMeasureChart key={panel.id} panel={panel} />
                  ))}
                </div>
              ) : (
                <EmptyState label="Aucune constante" />
              )}
            </div>
            <div className="overflow-hidden rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-medium">
                  Releve des constantes
                </h3>
              </div>
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <MedicalColumnHead
                        label="T"
                        tooltip="Temperature corporelle"
                      />
                      <MedicalColumnHead
                        label="FC"
                        tooltip="Frequence cardiaque"
                      />
                      <MedicalColumnHead
                        label="TA"
                        tooltip="Tension arterielle"
                      />
                      <MedicalColumnHead
                        label="SpO2"
                        tooltip="Saturation pulsee en oxygene"
                      />
                      <MedicalColumnHead
                        label="Poids"
                        tooltip="Poids corporel"
                      />
                      <MedicalColumnHead
                        label="Diurese"
                        tooltip="Volume urinaire releve"
                      />
                      <MedicalColumnHead
                        label="Selles"
                        tooltip="Date des dernieres selles"
                      />
                      <TableHead className="w-px px-1 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vitals.map((record) => (
                      <TableRow
                        key={record.id}
                        className={
                          vitalDialogOpen && editingVitalId === record.id
                            ? "bg-primary/5"
                            : ""
                        }
                      >
                        <TableCell>
                          {formatShortDateTime(record.recordedAt)}
                        </TableCell>
                        <TableCell>{record.temperature.toFixed(1)}</TableCell>
                        <TableCell>{record.heartRate}</TableCell>
                        <TableCell>
                          {record.systolicBloodPressure}/
                          {record.diastolicBloodPressure}
                        </TableCell>
                        <TableCell>
                          {record.oxygenSaturation.toFixed(0)}%
                        </TableCell>
                        <TableCell>{record.weight.toFixed(1)} kg</TableCell>
                        <TableCell>
                          {record.diuresis ? `${record.diuresis} ml` : "-"}
                        </TableCell>
                        <TableCell>{formatDate(record.lastStoolDate)}</TableCell>
                        <TableCell className="w-px px-1">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Modifier la mesure du ${formatShortDateTime(
                                    record.recordedAt
                                  )}`}
                                  onClick={() => handleEditVital(record)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modifier</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon-sm"
                                  aria-label={`Supprimer la mesure du ${formatShortDateTime(
                                    record.recordedAt
                                  )}`}
                                  onClick={() => void handleDeleteVital(record)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>

            <Dialog open={vitalDialogOpen} onOpenChange={setVitalDialogOpen}>
              <DialogContent forceMount className="sm:max-w-xl">
                <form className="grid gap-4" onSubmit={handleSubmitVital}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingVitalId ? "Modifier la mesure" : "Nouvelle mesure"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Saisie des constantes vitales
                    </DialogDescription>
                  </DialogHeader>
                  <Field label="Date et heure">
                    <DateTimeTextInput
                      required
                      value={vitalForm.recordedAt}
                      onValueChange={(recordedAt) =>
                        setVitalForm((current) => ({
                          ...current,
                          recordedAt,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="Temperature"
                      value={vitalForm.temperature}
                      onChange={(value) =>
                        setVitalForm((current) => ({
                          ...current,
                          temperature: value,
                        }))
                      }
                    />
                    <NumberField
                      label="FC"
                      value={vitalForm.heartRate}
                      onChange={(value) =>
                        setVitalForm((current) => ({
                          ...current,
                          heartRate: value,
                        }))
                      }
                    />
                    <NumberField
                      label="TAS"
                      value={vitalForm.systolicBloodPressure}
                      onChange={(value) =>
                        setVitalForm((current) => ({
                          ...current,
                          systolicBloodPressure: value,
                        }))
                      }
                    />
                    <NumberField
                      label="TAD"
                      value={vitalForm.diastolicBloodPressure}
                      onChange={(value) =>
                        setVitalForm((current) => ({
                          ...current,
                          diastolicBloodPressure: value,
                        }))
                      }
                    />
                    <NumberField
                      label="SpO2"
                      value={vitalForm.oxygenSaturation}
                      onChange={(value) =>
                        setVitalForm((current) => ({
                          ...current,
                          oxygenSaturation: value,
                        }))
                      }
                    />
                    <NumberField
                      label="Poids"
                      value={vitalForm.weight}
                      onChange={(value) =>
                        setVitalForm((current) => ({
                          ...current,
                          weight: value,
                        }))
                      }
                    />
                  </div>
                  <NumberField
                    label="Diurese"
                    required={false}
                    value={vitalForm.diuresis}
                    onChange={(value) =>
                      setVitalForm((current) => ({ ...current, diuresis: value }))
                    }
                  />
                  <Field label="Dernieres selles">
                    <DateTextInput
                      required
                      value={vitalForm.lastStoolDate}
                      onValueChange={(lastStoolDate) =>
                        setVitalForm((current) => ({
                          ...current,
                          lastStoolDate,
                        }))
                      }
                    />
                  </Field>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelVitalEdit}
                    >
                      <XCircle className="size-4" />
                      Fermer
                    </Button>
                    <Button type="submit">
                      {editingVitalId ? (
                        <Save className="size-4" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      {editingVitalId ? "Enregistrer" : "Ajouter"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </section>
        </TabsContent>

        <TabsContent value="prescriptions">
          <section className="grid gap-4">
            <div className="space-y-4 rounded-lg border bg-background p-4">
              <SectionTitle
                icon={ClipboardList}
                title="Prescriptions"
                action={
                  <Button type="button" onClick={handleOpenPrescriptionDialog}>
                    <Plus className="size-4" />
                    Nouvelle prescription
                  </Button>
                }
              />

              <div className="flex flex-wrap items-end gap-3">
                <Field label="Medicament">
                  <Input
                    className="w-52 max-w-full"
                    value={prescriptionFilters.medication}
                    onChange={(event) =>
                      setPrescriptionFilters((current) => ({
                        ...current,
                        medication: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Prescripteur">
                  <Input
                    className="w-52 max-w-full"
                    value={prescriptionFilters.prescriber}
                    onChange={(event) =>
                      setPrescriptionFilters((current) => ({
                        ...current,
                        prescriber: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Voie">
                  <Input
                    className="w-36 max-w-full"
                    value={prescriptionFilters.route}
                    onChange={(event) =>
                      setPrescriptionFilters((current) => ({
                        ...current,
                        route: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Debut min">
                  <DateTextInput
                    className="w-40 max-w-full"
                    value={prescriptionFilters.startDateFrom}
                    onValueChange={(startDateFrom) =>
                      setPrescriptionFilters((current) => ({
                        ...current,
                        startDateFrom,
                      }))
                    }
                  />
                </Field>
                <Field label="Debut max">
                  <DateTextInput
                    className="w-40 max-w-full"
                    value={prescriptionFilters.startDateTo}
                    onValueChange={(startDateTo) =>
                      setPrescriptionFilters((current) => ({
                        ...current,
                        startDateTo,
                      }))
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasPrescriptionFilters}
                  onClick={() =>
                    setPrescriptionFilters(emptyPrescriptionFilters())
                  }
                >
                  <XCircle className="size-4" />
                  Effacer
                </Button>
              </div>

              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicament</TableHead>
                      <TableHead>Dose</TableHead>
                      <TableHead>Frequence</TableHead>
                      <TableHead>Voie</TableHead>
                      <TableHead>Debut</TableHead>
                      <TableHead>Prescripteur</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrescriptions.map((prescription) => (
                      <TableRow key={prescription.id}>
                        <TableCell>{prescription.medication}</TableCell>
                        <TableCell>{prescription.dosage}</TableCell>
                        <TableCell>{prescription.frequency}</TableCell>
                        <TableCell>{prescription.route}</TableCell>
                        <TableCell>
                          {formatDate(prescription.startDate)}
                        </TableCell>
                        <TableCell>{prescription.prescriber}</TableCell>
                        <TableCell>
                          <Select
                            value={prescription.status}
                            onValueChange={(status) =>
                              void handlePrescriptionStatus(
                                prescription.id,
                                status
                              )
                            }
                          >
                            <SelectTrigger className="max-w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRESCRIPTION_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {prescriptionStatusLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {prescriptions.length === 0 && (
                <EmptyState label="Aucune prescription" />
              )}
              {prescriptions.length > 0 && filteredPrescriptions.length === 0 && (
                <EmptyState label="Aucune prescription pour ces filtres" />
              )}
            </div>

            <Dialog
              open={prescriptionDialogOpen}
              onOpenChange={setPrescriptionDialogOpen}
            >
              <DialogContent className="sm:max-w-4xl">
                <PrescriptionForm
                  form={prescriptionForm}
                  prescriber={currentAccount.name}
                  onChange={setPrescriptionForm}
                  onSubmit={handleAddPrescription}
                  onCancel={() => setPrescriptionDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </section>
        </TabsContent>

        <TabsContent value="labs">
          <section className="grid gap-4">
            <div className="space-y-4 rounded-lg border bg-background p-4">
              <SectionTitle
                icon={FlaskConical}
                title="Biologie"
                action={
                  <Button type="button" onClick={handleOpenLabDialog}>
                    <Plus className="size-4" />
                    Nouveau bilan
                  </Button>
                }
              />
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Type de biologie">
                  <Select
                    value={labPanelFilter}
                    onValueChange={(value) => {
                      setLabPanelFilter(value as LabPanelType | "all")
                      setLabMarkerFilters({})
                    }}
                  >
                    <SelectTrigger className="max-w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les bilans</SelectItem>
                      {LAB_PANEL_TYPES.map((panelType) => (
                        <SelectItem key={panelType} value={panelType}>
                          {panelType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Statut">
                  <Select
                    value={labStatusFilter}
                    onValueChange={setLabStatusFilter}
                  >
                    <SelectTrigger className="max-w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      {LAB_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {labStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {labPanelFilter !== "all" && (
                <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Filtres de valeurs
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {labPanelDefinition(labPanelFilter).markers.map((marker) => {
                      const markerFilter =
                        labMarkerFilters[marker.key] ??
                        emptyLabMarkerRangeFilter()
                      const isFiltered =
                        hasLabMarkerRangeFilter(markerFilter)

                      return (
                        <Popover key={marker.key}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className={cn(
                                "h-7",
                                isFiltered &&
                                  "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                              )}
                              aria-pressed={isFiltered}
                            >
                              {marker.label}
                              {marker.unit ? (
                                <span className="text-muted-foreground">
                                  ({marker.unit})
                                </span>
                              ) : null}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-56">
                            <div className="grid gap-3">
                              <p className="text-sm font-medium">
                                {marker.label}
                                {marker.unit ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    ({marker.unit})
                                  </span>
                                ) : null}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <Field label="Min">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={markerFilter.min}
                                    onChange={(event) =>
                                      updateLabMarkerFilter(marker.key, {
                                        min: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                                <Field label="Max">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={markerFilter.max}
                                    onChange={(event) =>
                                      updateLabMarkerFilter(marker.key, {
                                        max: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                              </div>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={!isFiltered}
                                onClick={() => clearLabMarkerFilter(marker.key)}
                              >
                                Effacer
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )
                    })}
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prelevement</TableHead>
                    <TableHead>Bilan</TableHead>
                    <TableHead>Valeurs</TableHead>
                    <TableHead>Apercu</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLabs.map((panel) => (
                    <TableRow
                      key={panel.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedLabPanel(panel)}
                    >
                      <TableCell>{formatShortDateTime(panel.sampledAt)}</TableCell>
                      <TableCell>{panel.panelType}</TableCell>
                      <TableCell>{panel.results.length}</TableCell>
                      <TableCell>
                        {formatLabPanelPreview(panel)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={panel.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {labs.length === 0 && <EmptyState label="Aucun resultat" />}
              {labs.length > 0 && filteredLabs.length === 0 && (
                <EmptyState label="Aucun resultat pour ces filtres" />
              )}
            </div>
          </section>
          <LabPanelDialog
            form={labForm}
            open={labDialogOpen}
            onChange={setLabForm}
            onOpenChange={setLabDialogOpen}
            onSubmit={handleAddLab}
          />
          <LabPanelDetailsDialog
            panel={selectedLabPanel}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedLabPanel(null)
              }
            }}
          />
        </TabsContent>

        <TabsContent value="documents">
          <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4 rounded-lg border bg-background p-4">
              <SectionTitle
                icon={FileText}
                title="Documents medicaux"
                action={
                  <Select
                    value={documentFilter}
                    onValueChange={(value) =>
                      setDocumentFilter(value as MedicalDocumentCategory | "all")
                    }
                  >
                    <SelectTrigger className="max-w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes categories</SelectItem>
                      {DOCUMENT_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {DOCUMENT_CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {documents.map((document) => (
                  <article
                    key={document.id}
                    className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{document.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_CATEGORY_LABELS[document.category]} ·{" "}
                        {formatShortDateTime(document.createdAt)}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {document.originalFileName ?? document.storagePath ?? "Reference"}
                      {document.fileSizeBytes
                        ? ` · ${formatFileSize(document.fileSizeBytes)}`
                        : ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleOpenDocument(document.id)}
                      >
                        <ExternalLink className="size-4" />
                        Ouvrir
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleDownloadDocument(document)}
                      >
                        <Download className="size-4" />
                        Fichier
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              {documents.length === 0 && <EmptyState label="Aucun document" />}
            </div>
            <form
              className="grid content-start gap-3 rounded-lg border bg-background p-4"
              onSubmit={handleAddDocument}
            >
              <SectionTitle icon={FileUp} title="Ajouter un document" />
              <Field label="Titre">
                <Input
                  required
                  value={documentForm.title}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Categorie">
                <Select
                  value={documentForm.category}
                  onValueChange={(category) =>
                    setDocumentForm((current) => ({
                      ...current,
                      category: category as MedicalDocumentCategory,
                    }))
                  }
                >
                  <SelectTrigger className="max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {DOCUMENT_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference fichier">
                <Input
                  value={documentForm.storagePath}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      storagePath: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Fichier">
                <Input
                  key={documentFileKey}
                  type="file"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setDocumentFile(event.target.files?.[0] ?? null)
                  }
                />
              </Field>
              <Button type="submit">
                <FileUp className="size-4" />
                Ajouter
              </Button>
            </form>
          </section>
        </TabsContent>

        <TabsContent value="evolution">
          <section className="rounded-lg border bg-background p-4">
            <SectionTitle icon={Activity} title="Evolution clinique" />
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
              <button
                type="button"
                className="group grid aspect-square min-h-56 place-items-center rounded-lg border border-dashed bg-card p-4 text-primary shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Ajouter une nouvelle note"
                onClick={handleOpenEvolutionDialog}
              >
                <Plus className="size-10" />
              </button>
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className="group grid aspect-square min-h-56 content-start overflow-hidden rounded-lg border bg-card p-4 text-left text-sm shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Ouvrir la note du ${formatShortDateTime(
                    note.recordedAt
                  )}`}
                  onClick={() => setSelectedEvolutionNote(note)}
                >
                  <span className="text-4xl leading-none font-semibold text-foreground">
                    {formatEvolutionNoteDay(note.recordedAt)}
                  </span>
                  <span className="mt-1 text-xs font-medium text-muted-foreground uppercase">
                    {formatEvolutionNoteMonth(note.recordedAt)}
                  </span>
                  <span className="mt-2 truncate font-medium">
                    {note.service} · Passage {note.visitId}
                  </span>
                  <span className="mt-1 truncate text-xs text-muted-foreground">
                    {note.author} · {formatEvolutionNoteTime(note.recordedAt)}
                  </span>
                  <span className="mt-2 overflow-hidden leading-5 text-muted-foreground whitespace-pre-wrap [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5]">
                    {note.content}
                  </span>
                </button>
              ))}
            </div>
            <Dialog
              open={selectedEvolutionNote !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedEvolutionNote(null)
                }
              }}
            >
              <DialogContent className="sm:max-w-2xl">
                {selectedEvolutionNote && (
                  <div className="grid gap-5">
                    <DialogHeader>
                      <DialogTitle>
                        Note du{" "}
                        {formatShortDateTime(selectedEvolutionNote.recordedAt)}
                      </DialogTitle>
                      <DialogDescription>
                        {selectedEvolutionNote.service} · Passage{" "}
                        {selectedEvolutionNote.visitId} ·{" "}
                        {selectedEvolutionNote.author}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/20 p-4 leading-6 whitespace-pre-wrap">
                      {selectedEvolutionNote.content}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog
              open={evolutionDialogOpen}
              onOpenChange={setEvolutionDialogOpen}
            >
              <DialogContent className="sm:max-w-xl">
                <form className="grid gap-4" onSubmit={handleAddEvolution}>
                  <DialogHeader>
                    <DialogTitle>Nouvelle note</DialogTitle>
                    <DialogDescription className="sr-only">
                      Creation d'une note d'evolution
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Service">
                      <ServiceSelect
                        services={services}
                        required
                        value={evolutionForm.service}
                        onChange={(service) =>
                          setEvolutionForm((current) => ({
                            ...current,
                            service,
                          }))
                        }
                        disabled
                      />
                    </Field>
                    <Field label="Passage">
                      <Input
                        required
                        value={evolutionForm.visitId}
                        onChange={(event) =>
                          setEvolutionForm((current) => ({
                            ...current,
                            visitId: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Date et heure">
                    <DateTimeTextInput
                      required
                      value={evolutionForm.recordedAt}
                      onValueChange={(recordedAt) =>
                        setEvolutionForm((current) => ({
                          ...current,
                          recordedAt,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Contenu">
                    <Textarea
                      required
                      className="min-h-44"
                      value={evolutionForm.content}
                      onChange={(event) =>
                        setEvolutionForm((current) => ({
                          ...current,
                          content: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEvolutionDialogOpen(false)}
                    >
                      Fermer
                    </Button>
                    <Button type="submit">
                      <Plus className="size-4" />
                      Ajouter
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PrescriptionForm({
  form,
  prescriber,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: PrescriptionFormState
  prescriber: string
  onChange: (form: PrescriptionFormState) => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  function updateMedication(
    index: number,
    values: Partial<PrescriptionMedicationFormState>
  ) {
    onChange({
      ...form,
      medications: form.medications.map((medication, medicationIndex) =>
        medicationIndex === index ? { ...medication, ...values } : medication
      ),
    })
  }

  function addMedication() {
    onChange({
      ...form,
      medications: [...form.medications, emptyPrescriptionMedicationForm()],
    })
  }

  function removeMedication(index: number) {
    if (form.medications.length === 1) {
      return
    }

    onChange({
      ...form,
      medications: form.medications.filter(
        (_medication, medicationIndex) => medicationIndex !== index
      ),
    })
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Nouvelle prescription</DialogTitle>
        <DialogDescription className="sr-only">
          Ajout d'une prescription medicamenteuse
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Debut">
          <DateTextInput
            required
            value={form.startDate}
            onValueChange={(startDate) => onChange({ ...form, startDate })}
          />
        </Field>
        <Field label="Fin">
          <DateTextInput
            value={form.endDate}
            onValueChange={(endDate) => onChange({ ...form, endDate })}
          />
        </Field>
        <Field label="Statut">
          <Select
            value={form.status}
            onValueChange={(status) => onChange({ ...form, status })}
          >
            <SelectTrigger className="max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESCRIPTION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {prescriptionStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Prescripteur">
          <Input readOnly value={prescriber} />
        </Field>
      </div>

      <div className="grid gap-3">
        {form.medications.map((medication, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]"
          >
            <Field label="Medicament">
              <MedicineSearchInput
                medication={medication}
                onChange={(values) => updateMedication(index, values)}
              />
            </Field>
            <Field label="Dose">
              <Input
                required
                value={medication.dosage}
                onChange={(event) =>
                  updateMedication(index, { dosage: event.target.value })
                }
              />
            </Field>
            <Field label="Frequence">
              <Input
                required
                value={medication.frequency}
                onChange={(event) =>
                  updateMedication(index, { frequency: event.target.value })
                }
              />
            </Field>
            <Field label="Voie">
              <Input
                required
                value={medication.route}
                onChange={(event) =>
                  updateMedication(index, { route: event.target.value })
                }
              />
            </Field>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                disabled={form.medications.length === 1}
                onClick={() => removeMedication(index)}
                aria-label="Retirer ce medicament"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Button type="button" variant="outline" onClick={addMedication}>
          <Plus className="size-4" />
          Ajouter un medicament
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="size-4" />
          Fermer
        </Button>
        <Button type="submit">
          <Plus className="size-4" />
          Ajouter
        </Button>
      </DialogFooter>
    </form>
  )
}

function MedicineSearchInput({
  medication,
  onChange,
}: {
  medication: PrescriptionMedicationFormState
  onChange: (values: Partial<PrescriptionMedicationFormState>) => void
}) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const query = medication.medicationQuery.trim()
  const selected = medication.medicineId !== ""

  useEffect(() => {
    if (selected || query.length < MEDICINE_QUERY_MIN_LENGTH) {
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setSearchError("")

      searchMedicines(query)
        .then((medicines) => {
          if (!cancelled) {
            setResults(medicines)
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setResults([])
            setSearchError(errorMessage(error))
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [query, selected])

  function handleQueryChange(value: string) {
    setResults([])
    setLoading(false)
    setSearchError("")

    const hasSearchLength = value.trim().length >= MEDICINE_QUERY_MIN_LENGTH

    onChange({
      medicineId: "",
      medication: "",
      medicationQuery: value,
      dosage: "",
      route: "",
    })
    setLoading(hasSearchLength)
    setOpen(hasSearchLength)
  }

  function selectMedicine(medicine: Medicine) {
    onChange({
      medicineId: medicine.id,
      medication: medicine.name,
      medicationQuery: medicine.name,
      dosage: defaultMedicineDosage(medicine),
      route: defaultMedicineRoute(medicine),
    })
    setOpen(false)
    setResults([])
    setLoading(false)
    setSearchError("")
  }

  const showResults =
    open && !selected && query.length >= MEDICINE_QUERY_MIN_LENGTH

  return (
    <div className="grid gap-1">
      <Popover open={showResults} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              required
              className="pr-2.5 pl-8"
              value={medication.medicationQuery}
              aria-invalid={!selected && medication.medicationQuery.trim() !== ""}
              onFocus={() => setOpen(true)}
              onChange={(event) => handleQueryChange(event.target.value)}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[min(34rem,calc(100vw-2rem))] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="max-h-72 overflow-auto">
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
                Aucun medicament trouve
              </p>
            )}
            {!loading &&
              !searchError &&
              results.map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  className="grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => selectMedicine(medicine)}
                >
                  <span className="font-medium">{medicine.name}</span>
                  <span className="text-xs text-muted-foreground">
                    CIS {medicine.id}
                    {medicine.form ? ` · ${medicine.form}` : ""}
                    {medicine.administrationRoutes
                      ? ` · ${medicine.administrationRoutes}`
                      : ""}
                  </span>
                  {medicine.activeSubstances || medicine.dosageSummary ? (
                    <span className="text-xs text-muted-foreground">
                      {[medicine.activeSubstances, medicine.dosageSummary]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">CIS {medication.medicineId}</Badge>
          <span className="truncate">{medication.medication}</span>
        </div>
      )}
    </div>
  )
}

function LabPanelDialog({
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

function LabPanelDetailsDialog({
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
                Prelevement du {formatShortDateTime(panel.sampledAt)} ·{" "}
                {panel.results.length} valeur
                {panel.results.length > 1 ? "s" : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marqueur</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Reference</TableHead>
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

function AdminPanel({
  onCatalogChanged,
}: {
  onCatalogChanged: () => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [includeDisabled, setIncludeDisabled] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<AccountFormState>(
    emptyAccountForm()
  )
  const [editForm, setEditForm] = useState<AccountFormState>(emptyAccountForm())
  const [createServiceForm, setCreateServiceForm] = useState<ServiceFormState>(
    emptyServiceForm()
  )
  const [editServiceForm, setEditServiceForm] = useState<ServiceFormState>(
    emptyServiceForm()
  )
  const [createBedForm, setCreateBedForm] = useState<BedFormState>(
    emptyBedForm()
  )
  const [editBedForm, setEditBedForm] = useState<BedFormState>(emptyBedForm())
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId
  )
  const selectedService = services.find(
    (service) => service.id === selectedServiceId
  )
  const selectedBed = beds.find((bed) => bed.id === selectedBedId)
  const defaultServiceName = services[0]?.name ?? ""

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const result = await listAccounts({ includeDisabled })
      setAccounts(result)
      setSelectedAccountId((current) => {
        if (current && result.some((account) => account.id === current)) {
          return current
        }

        return result[0]?.id ?? null
      })
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [includeDisabled])

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setError("")

    try {
      const [serviceResult, bedResult] = await Promise.all([
        listServices(),
        listBeds(),
      ])
      const firstServiceName = serviceResult[0]?.name ?? ""
      setServices(serviceResult)
      setBeds(bedResult)
      if (firstServiceName) {
        setCreateForm((current) =>
          current.service ? current : { ...current, service: firstServiceName }
        )
        setCreateBedForm((current) =>
          current.service ? current : { ...current, service: firstServiceName }
        )
      }
      setSelectedServiceId((current) => {
        if (current && serviceResult.some((service) => service.id === current)) {
          return current
        }

        return serviceResult[0]?.id ?? null
      })
      setSelectedBedId((current) => {
        if (current && bedResult.some((bed) => bed.id === current)) {
          return current
        }

        return bedResult[0]?.id ?? null
      })
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAccounts()
      void loadCatalog()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadAccounts, loadCatalog])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!selectedAccountId) {
        setEditForm(emptyAccountForm())
        return
      }

      getAccount(selectedAccountId)
        .then((account) => setEditForm(accountToForm(account)))
        .catch((loadError) => setError(errorMessage(loadError)))
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [selectedAccountId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setEditServiceForm(
        selectedService ? serviceToForm(selectedService) : emptyServiceForm()
      )
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [selectedService])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setEditBedForm(
        selectedBed ? bedToForm(selectedBed) : emptyBedForm(defaultServiceName)
      )
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [defaultServiceName, selectedBed])

  async function runAdminAction(action: () => Promise<void>, okMessage: string) {
    setError("")
    setSuccess("")

    try {
      await action()
      setSuccess(okMessage)
    } catch (actionError) {
      setError(errorMessage(actionError))
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAdminAction(async () => {
      const result = await createAccount({
        name: createForm.name,
        email: createForm.email,
        role: createForm.role,
        service: createForm.service,
        invite: createForm.invite,
      })
      setGeneratedPassword(result.generatedPassword)
      setCreateForm(emptyAccountForm(defaultServiceName))
      await loadAccounts()
      setSelectedAccountId(result.account.id)
    }, "Compte cree")
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAdminAction(async () => {
      const service = await createService({ name: createServiceForm.name })
      setCreateServiceForm(emptyServiceForm())
      await loadCatalog()
      onCatalogChanged()
      setSelectedServiceId(service.id)
    }, "Service cree")
  }

  async function handleUpdateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedServiceId) {
      return
    }

    await runAdminAction(async () => {
      await updateService(selectedServiceId, { name: editServiceForm.name })
      await Promise.all([loadCatalog(), loadAccounts()])
      onCatalogChanged()
    }, "Service mis a jour")
  }

  async function handleDeleteService() {
    if (!selectedService) {
      return
    }

    const confirmed = window.confirm(`Supprimer le service ${selectedService.name} ?`)

    if (!confirmed) {
      return
    }

    await runAdminAction(async () => {
      await deleteService(selectedService.id)
      await loadCatalog()
      onCatalogChanged()
    }, "Service supprime")
  }

  async function handleCreateBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAdminAction(async () => {
      const bed = await createBed(bedFormToInput(createBedForm))
      setCreateBedForm(emptyBedForm(defaultServiceName))
      await loadCatalog()
      onCatalogChanged()
      setSelectedBedId(bed.id)
    }, "Lit cree")
  }

  async function handleUpdateBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedBedId) {
      return
    }

    await runAdminAction(async () => {
      await updateBed(selectedBedId, bedFormToInput(editBedForm))
      await loadCatalog()
      onCatalogChanged()
    }, "Lit mis a jour")
  }

  async function handleDeleteBed() {
    if (!selectedBed) {
      return
    }

    const confirmed = window.confirm(`Supprimer le lit ${selectedBed.label} ?`)

    if (!confirmed) {
      return
    }

    await runAdminAction(async () => {
      await deleteBed(selectedBed.id)
      await loadCatalog()
      onCatalogChanged()
    }, "Lit supprime")
  }

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedAccountId) {
      return
    }

    await runAdminAction(async () => {
      await updateAccount(selectedAccountId, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        service: editForm.service,
      })
      await loadAccounts()
    }, "Compte mis a jour")
  }

  async function handleAssignRole() {
    if (!selectedAccountId) {
      return
    }

    await runAdminAction(async () => {
      await assignRole(selectedAccountId, editForm.role)
      await loadAccounts()
    }, "Role affecte")
  }

  async function handleDisableAccount() {
    if (!selectedAccountId) {
      return
    }

    await runAdminAction(async () => {
      await disableAccount(selectedAccountId)
      await loadAccounts()
    }, "Compte suspendu")
  }

  async function handleResetPassword() {
    if (!selectedAccountId) {
      return
    }

    await runAdminAction(async () => {
      const result = await resetAccountPassword(selectedAccountId)
      setGeneratedPassword(result.generatedPassword)
      await loadAccounts()
    }, "Mot de passe regenere")
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-medium">
            Administration
          </h2>
          <p className="text-sm text-muted-foreground">
            {accounts.length} compte{accounts.length > 1 ? "s" : ""} ·{" "}
            {services.length} service{services.length > 1 ? "s" : ""} ·{" "}
            {beds.length} lit{beds.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={includeDisabled}
              onChange={(event) => setIncludeDisabled(event.target.checked)}
            />
            Inclure suspendus
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void loadAccounts()
              void loadCatalog()
            }}
          >
            <RefreshCw
              className={
                loading || catalogLoading ? "size-4 animate-spin" : "size-4"
              }
            />
            Actualiser
          </Button>
        </div>
      </div>

      {error && <AlertMessage message={error} />}
      {success && <AlertMessage tone="success" message={success} />}
      {generatedPassword && (
        <AlertMessage
          tone="success"
          message={`Mot de passe genere: ${generatedPassword}`}
        />
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border bg-background p-4">
          <SectionTitle icon={Building2} title="Services" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Comptes</TableHead>
                <TableHead>Lits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow
                  key={service.id}
                  className={
                    selectedServiceId === service.id ? "bg-primary/5" : ""
                  }
                  onClick={() => setSelectedServiceId(service.id)}
                >
                  <TableCell>{service.name}</TableCell>
                  <TableCell>
                    {
                      accounts.filter((account) => account.service === service.name)
                        .length
                    }
                  </TableCell>
                  <TableCell>
                    {beds.filter((bed) => bed.service === service.name).length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {services.length === 0 && <EmptyState label="Aucun service" />}
        </div>

        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-lg border bg-background p-4"
            onSubmit={handleCreateService}
          >
            <SectionTitle icon={Plus} title="Nouveau service" />
            <Field label="Nom">
              <Input
                required
                value={createServiceForm.name}
                onChange={(event) =>
                  setCreateServiceForm({ name: event.target.value })
                }
              />
            </Field>
            <Button type="submit">
              <Plus className="size-4" />
              Creer
            </Button>
          </form>

          <form
            className="grid gap-3 rounded-lg border bg-background p-4"
            onSubmit={handleUpdateService}
          >
            <SectionTitle icon={Building2} title="Service selectionne" />
            {selectedService ? (
              <>
                <Field label="Nom">
                  <Input
                    required
                    value={editServiceForm.name}
                    onChange={(event) =>
                      setEditServiceForm({ name: event.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="submit">
                    <Save className="size-4" />
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteService()}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState label="Aucun service selectionne" />
            )}
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border bg-background p-4">
          <SectionTitle icon={BedIcon} title="Lits" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libelle</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Patient</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beds.map((bed) => (
                <TableRow
                  key={bed.id}
                  className={selectedBedId === bed.id ? "bg-primary/5" : ""}
                  onClick={() => setSelectedBedId(bed.id)}
                >
                  <TableCell>{bed.label}</TableCell>
                  <TableCell>{bed.service}</TableCell>
                  <TableCell>{bed.occupiedPatientName ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {beds.length === 0 && <EmptyState label="Aucun lit" />}
        </div>

        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-lg border bg-background p-4"
            onSubmit={handleCreateBed}
          >
            <SectionTitle icon={Plus} title="Nouveau lit" />
            <BedFields
              form={createBedForm}
              services={services}
              onChange={setCreateBedForm}
            />
            <Button type="submit" disabled={services.length === 0}>
              <Plus className="size-4" />
              Creer
            </Button>
          </form>

          <form
            className="grid gap-3 rounded-lg border bg-background p-4"
            onSubmit={handleUpdateBed}
          >
            <SectionTitle icon={BedIcon} title="Lit selectionne" />
            {selectedBed ? (
              <>
                <BedFields
                  form={editBedForm}
                  services={services}
                  onChange={setEditBedForm}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="submit">
                    <Save className="size-4" />
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={Boolean(selectedBed.occupiedPatientId)}
                    onClick={() => void handleDeleteBed()}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState label="Aucun lit selectionne" />
            )}
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border bg-background p-4">
          <SectionTitle icon={Users} title="Utilisateurs" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Courriel</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className={
                    selectedAccountId === account.id ? "bg-primary/5" : ""
                  }
                  onClick={() => setSelectedAccountId(account.id)}
                >
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{ROLE_LABELS[account.role]}</TableCell>
                  <TableCell>{account.service}</TableCell>
                  <TableCell>
                    <AccountStatusBadge status={account.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {accounts.length === 0 && <EmptyState label="Aucun compte" />}
        </div>

        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-lg border bg-background p-4"
            onSubmit={handleCreateAccount}
          >
            <SectionTitle icon={UserPlus} title="Nouveau compte" />
            <AccountFields
              form={createForm}
              services={services}
              onChange={setCreateForm}
              invite
            />
            <Button type="submit" disabled={services.length === 0}>
              <UserPlus className="size-4" />
              Creer
            </Button>
          </form>

          <form
            className="grid gap-3 rounded-lg border bg-background p-4"
            onSubmit={handleUpdateAccount}
          >
            <SectionTitle icon={UserCog} title="Compte selectionne" />
            {selectedAccount ? (
              <>
                <AccountFields
                  form={editForm}
                  services={services}
                  onChange={setEditForm}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="submit">
                    <Save className="size-4" />
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleAssignRole()}
                  >
                    <ShieldCheck className="size-4" />
                    Affecter role
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleResetPassword()}
                  >
                    <KeyRound className="size-4" />
                    Mot de passe
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={selectedAccount.status === "disabled"}
                    onClick={() => void handleDisableAccount()}
                  >
                    <Ban className="size-4" />
                    Suspendre
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState label="Aucun compte selectionne" />
            )}
          </form>
        </div>
      </section>
    </div>
  )
}

function AccountFields({
  form,
  services,
  onChange,
  invite = false,
}: {
  form: AccountFormState
  services: Service[]
  onChange: (form: AccountFormState) => void
  invite?: boolean
}) {
  return (
    <>
      <Field label="Nom">
        <Input
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="Courriel">
        <Input
          required
          type="email"
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Role">
          <Select
            value={form.role}
            onValueChange={(role) => onChange({ ...form, role: role as UserRole })}
          >
            <SelectTrigger className="max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Service">
          <ServiceSelect
            services={services}
            required
            value={form.service}
            onChange={(service) => onChange({ ...form, service })}
          />
        </Field>
      </div>
      {invite && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={form.invite}
            onChange={(event) =>
              onChange({ ...form, invite: event.target.checked })
            }
          />
          Marquer comme invite
        </label>
      )}
    </>
  )
}

function BedFields({
  form,
  services,
  onChange,
}: {
  form: BedFormState
  services: Service[]
  onChange: (form: BedFormState) => void
}) {
  return (
    <>
      <Field label="Libelle">
        <Input
          required
          value={form.label}
          onChange={(event) => onChange({ ...form, label: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Service">
          <ServiceSelect
            services={services}
            required
            value={form.service}
            onChange={(service) => onChange({ ...form, service })}
          />
        </Field>
        <Field label="Ordre">
          <Input
            type="number"
            min="1"
            step="1"
            value={form.sortOrder}
            onChange={(event) =>
              onChange({ ...form, sortOrder: event.target.value })
            }
          />
        </Field>
      </div>
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      {children}
    </Label>
  )
}

function DateTextInput({
  className,
  disabled,
  required,
  value,
  onValueChange,
}: {
  className?: string
  disabled?: boolean
  required?: boolean
  value: string
  onValueChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    value,
    displayValue: formatDateTextInputValue(value),
  }))
  const displayValue =
    draft.value === value ? draft.displayValue : formatDateTextInputValue(value)
  const selectedDate = dateFromIsoValue(value)

  useEffect(() => {
    inputRef.current?.setCustomValidity("")
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = formatDateTextDraftValue(event.target.value)
    const parsedValue = parseDateTextInputValue(nextValue)

    setDraft({
      value: parsedValue ?? (nextValue.trim() === "" ? "" : value),
      displayValue: nextValue,
    })
    event.target.setCustomValidity(
      nextValue.trim() && parsedValue === null ? DATE_TEXT_INPUT_TITLE : ""
    )

    if (parsedValue !== null || nextValue.trim() === "") {
      onValueChange(parsedValue ?? "")
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const parsedValue = parseDateTextInputValue(event.target.value)

    if (parsedValue !== null) {
      setDraft({
        value: parsedValue,
        displayValue: formatDateTextInputValue(parsedValue),
      })
      event.target.setCustomValidity("")
    } else if (event.target.value.trim() === "") {
      setDraft({ value: "", displayValue: "" })
      event.target.setCustomValidity("")
    } else {
      event.target.setCustomValidity(DATE_TEXT_INPUT_TITLE)
    }
  }

  function selectDate(date: Date | undefined) {
    if (!date) {
      return
    }

    const nextValue = isoDateFromDate(date)
    setDraft({
      value: nextValue,
      displayValue: formatDateTextInputValue(nextValue),
    })
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex w-full min-w-0 gap-2", className)}>
        <Input
          ref={inputRef}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          placeholder="jj-mm-aaaa"
          title={DATE_TEXT_INPUT_TITLE}
          value={displayValue}
          onBlur={handleBlur}
          onChange={handleChange}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="size-9 shrink-0 px-0"
            disabled={disabled}
            aria-label="Ouvrir le calendrier"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={1}
          selected={selectedDate ?? undefined}
          defaultMonth={selectedDate ?? undefined}
          onSelect={selectDate}
        />
      </PopoverContent>
    </Popover>
  )
}

function DateTimeTextInput({
  className,
  disabled,
  required,
  value,
  onValueChange,
}: {
  className?: string
  disabled?: boolean
  required?: boolean
  value: string
  onValueChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    value,
    displayValue: formatDateTimeTextInputValue(value),
  }))
  const displayValue =
    draft.value === value
      ? draft.displayValue
      : formatDateTimeTextInputValue(value)
  const selectedDate = dateFromIsoValue(value)

  useEffect(() => {
    inputRef.current?.setCustomValidity("")
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = formatDateTimeTextDraftValue(event.target.value)
    const parsedValue = parseDateTimeTextInputValue(nextValue)

    setDraft({
      value: parsedValue ?? (nextValue.trim() === "" ? "" : value),
      displayValue: nextValue,
    })
    event.target.setCustomValidity(
      nextValue.trim() && parsedValue === null ? DATE_TIME_TEXT_INPUT_TITLE : ""
    )

    if (parsedValue !== null || nextValue.trim() === "") {
      onValueChange(parsedValue ?? "")
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const parsedValue = parseDateTimeTextInputValue(event.target.value)

    if (parsedValue !== null) {
      setDraft({
        value: parsedValue,
        displayValue: formatDateTimeTextInputValue(parsedValue),
      })
      event.target.setCustomValidity("")
    } else if (event.target.value.trim() === "") {
      setDraft({ value: "", displayValue: "" })
      event.target.setCustomValidity("")
    } else {
      event.target.setCustomValidity(DATE_TIME_TEXT_INPUT_TITLE)
    }
  }

  function selectDate(date: Date | undefined) {
    if (!date) {
      return
    }

    const nextValue = `${isoDateFromDate(date)}T${timeFromIsoDateTime(value)}`
    setDraft({
      value: nextValue,
      displayValue: formatDateTimeTextInputValue(nextValue),
    })
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex w-full min-w-0 gap-2", className)}>
        <Input
          ref={inputRef}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          placeholder="jj-mm-aaaa HH:mm"
          title={DATE_TIME_TEXT_INPUT_TITLE}
          value={displayValue}
          onBlur={handleBlur}
          onChange={handleChange}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="size-9 shrink-0 px-0"
            disabled={disabled}
            aria-label="Ouvrir le calendrier"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={1}
          selected={selectedDate ?? undefined}
          defaultMonth={selectedDate ?? undefined}
          onSelect={selectDate}
        />
      </PopoverContent>
    </Popover>
  )
}

function AddressAutocomplete({
  id,
  required,
  value,
  onChange,
}: {
  id: string
  required?: boolean
  value: string
  onChange: (value: string) => void
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const inputFocusedRef = useRef(false)
  const selectedValueRef = useRef("")
  const suggestionListId = `${id}-suggestions`
  const activeSuggestion = suggestions[activeIndex]

  useEffect(() => {
    const query = value.trim()

    if (
      query.length < ADDRESS_QUERY_MIN_LENGTH ||
      query === selectedValueRef.current
    ) {
      setSuggestions([])
      setOpen(false)
      setStatus("idle")
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setStatus("loading")

      searchAddressSuggestions(query, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) {
            return
          }

          setSuggestions(results)
          setActiveIndex(-1)
          setStatus("idle")
          setOpen(inputFocusedRef.current && results.length > 0)
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return
          }

          setSuggestions([])
          setActiveIndex(-1)
          setStatus("error")
          setOpen(inputFocusedRef.current)
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectedValueRef.current = ""
    onChange(event.target.value)
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    selectedValueRef.current = suggestion.label
    onChange(suggestion.label)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    setStatus("idle")
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (suggestions.length === 0) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex(
        (current) => (current <= 0 ? suggestions.length : current) - 1
      )
      return
    }

    if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault()
      selectSuggestion(activeSuggestion)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        required={required}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={suggestionListId}
        aria-expanded={open}
        aria-activedescendant={
          activeSuggestion ? `${suggestionListId}-${activeIndex}` : undefined
        }
        value={value}
        onBlur={() => {
          inputFocusedRef.current = false
          setOpen(false)
          setActiveIndex(-1)
        }}
        onChange={handleChange}
        onFocus={() => {
          inputFocusedRef.current = true
          setOpen(suggestions.length > 0 || status === "error")
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div
          id={suggestionListId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <button
              id={`${suggestionListId}-${index}`}
              key={`${suggestion.id}-${suggestion.label}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "grid w-full gap-0.5 rounded-sm px-2.5 py-2 text-left text-sm outline-none transition-colors",
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
              onMouseDown={(event) => {
                event.preventDefault()
                selectSuggestion(suggestion)
              }}
            >
              <span className="truncate font-medium">{suggestion.label}</span>
              {(suggestion.city || suggestion.context) && (
                <span className="truncate text-xs text-muted-foreground">
                  {[suggestion.city, suggestion.context]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </button>
          ))}

          {status === "loading" && suggestions.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Recherche...
            </div>
          )}

          {status === "error" && suggestions.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-destructive">
              Suggestions indisponibles
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function NumberField({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <Field label={label}>
      <Input
        required={required}
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function SexSelect({
  value,
  onChange,
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      required={required}
    >
      <SelectTrigger className="max-w-full">
        <Users className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Selectionner" />
      </SelectTrigger>
      <SelectContent>
        {PATIENT_SEXES.map((sex) => (
          <SelectItem key={sex} value={sex}>
            {PATIENT_SEX_LABELS[sex]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function BedSelect({
  beds,
  service,
  currentPatientId,
  value,
  onChange,
}: {
  beds: Bed[]
  service?: string
  currentPatientId?: string
  value: string
  onChange: (value: string) => void
}) {
  const assignableBeds = beds.filter(
    (bed) =>
      (!service || bed.service === service) &&
      (!bed.occupiedPatientId || bed.occupiedPatientId === currentPatientId)
  )

  return (
    <Select
      value={value || UNASSIGNED_BED_VALUE}
      onValueChange={(nextValue) =>
        onChange(nextValue === UNASSIGNED_BED_VALUE ? "" : nextValue)
      }
    >
      <SelectTrigger className="max-w-full">
        <BedIcon className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Lit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED_BED_VALUE}>Non assigne</SelectItem>
        {assignableBeds.map((bed) => (
          <SelectItem key={bed.id} value={bed.id}>
            {bedLabelText(bed)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ServiceSelect({
  services,
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  services: Service[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}) {
  return (
    <Select
      value={value || UNSELECTED_SERVICE_VALUE}
      onValueChange={(nextValue) => {
        if (nextValue !== UNSELECTED_SERVICE_VALUE) {
          onChange(nextValue)
        }
      }}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger className="max-w-full">
        <Building2 className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Service" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSELECTED_SERVICE_VALUE} disabled>
          Selectionner un service
        </SelectItem>
        {services.map((service) => (
          <SelectItem key={service.id} value={service.name}>
            {service.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Activity
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 font-heading text-base font-medium">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {action}
    </div>
  )
}

function VitalMeasureChart({ panel }: { panel: VitalChartPanel }) {
  const hasValues = panelHasValues(panel)
  const maxDecimals = Math.max(...panel.lines.map((line) => line.decimals))

  return (
    <div className="min-w-0 rounded-lg border bg-background p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{panel.title}</h3>
          <p className="text-xs text-muted-foreground">
            Derniere valeur: {panel.latestValue}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {panel.lines.length === 1 ? panel.lines[0].unit : "mmHg"}
        </span>
      </div>

      <div className="h-52 min-h-52 min-w-0">
        {hasValues ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={panel.data}
              margin={{ top: 28, right: 18, bottom: 4, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={18}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                width={34}
                domain={chartDomain(panel)}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) =>
                  formatChartPointValue(value, maxDecimals)
                }
              />
              <RechartsTooltip
                formatter={(value, name) => {
                  const line = panel.lines.find(
                    (item) => item.name === String(name)
                  )

                  return [
                    formatChartTooltipValue(
                      value,
                      line?.unit ?? "",
                      line?.decimals ?? 0
                    ),
                    name,
                  ]
                }}
              />
              {panel.lines.length > 1 && <Legend height={24} />}
              {panel.lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.stroke}
                  strokeWidth={2}
                  connectNulls
                  dot={{
                    r: 4,
                    fill: "var(--background)",
                    stroke: line.stroke,
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey={line.dataKey}
                    position={line.labelPosition ?? "top"}
                    offset={8}
                    className="fill-foreground text-[10px] font-medium"
                    formatter={(value) =>
                      formatChartPointValue(value, line.decimals)
                    }
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState label={panel.emptyLabel} />
        )}
      </div>
    </div>
  )
}

function MedicalColumnHead({
  label,
  tooltip,
}: {
  label: string
  tooltip: string
}) {
  return (
    <TableHead>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-help underline decoration-dotted underline-offset-4"
            tabIndex={0}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TableHead>
  )
}

function PatientInfoBadge({ children }: { children: string }) {
  return (
    <Badge
      variant="outline"
      className="h-auto max-w-full justify-start rounded-md bg-background px-2.5 py-1 text-left leading-5 whitespace-normal break-words text-muted-foreground"
    >
      {children}
    </Badge>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}

function ClinicalValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  )
}

function AlertMessage({
  message,
  tone = "error",
}: {
  message: string
  tone?: "error" | "success"
}) {
  const Icon = tone === "success" ? CheckCircle2 : XCircle

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        tone === "success"
          ? "border-primary/20 bg-primary/5 text-foreground"
          : "border-destructive/20 bg-destructive/5 text-destructive"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function StatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase()
  const displayLabel = labStatusLabel(label)
  const variant =
    normalized.includes("critique") || normalized.includes("alerte")
      ? "destructive"
      : normalized.includes("normal")
        ? "secondary"
        : "outline"

  return <Badge variant={variant}>{displayLabel}</Badge>
}

function labStatusLabel(status: string) {
  return LAB_STATUS_LABELS[status as LabStatus] ?? "Statut inconnu"
}

function prescriptionStatusLabel(status: string) {
  return PRESCRIPTION_STATUS_LABELS[status] ?? "Statut inconnu"
}

function formatLabPanelPreview(panel: LabPanel) {
  const preview = panel.results
    .slice(0, 3)
    .map((result) =>
      [result.markerLabel, `${result.value}${result.unit ? ` ${result.unit}` : ""}`].join(
        " "
      )
    )
    .join(" · ")

  if (!preview) {
    return "-"
  }

  const remainingCount = panel.results.length - 3
  return remainingCount > 0 ? `${preview} · +${remainingCount}` : preview
}

function labFormResult(form: LabFormState, markerKey: string) {
  return form.results[markerKey] ?? defaultLabFormResult()
}

function updateLabFormResult(
  form: LabFormState,
  markerKey: string,
  patch: Partial<LabFormResultState>
): LabFormState {
  return {
    ...form,
    results: {
      ...form.results,
      [markerKey]: {
        ...labFormResult(form, markerKey),
        ...patch,
      },
    },
  }
}

function labFormResultsToInput(form: LabFormState) {
  const definition = labPanelDefinition(form.panelType)

  return definition.markers
    .map((marker) => {
      const result = labFormResult(form, marker.key)

      return {
        markerKey: marker.key,
        markerLabel: marker.label,
        value: result.value.trim(),
        unit: marker.unit,
        referenceInterval: marker.referenceInterval,
        status: result.status,
      }
    })
    .filter((result) => result.value.length > 0)
}

function worstLabStatus(statuses: LabStatus[]): LabStatus {
  if (statuses.includes("critique")) {
    return "critique"
  }

  if (statuses.includes("alerte")) {
    return "alerte"
  }

  if (statuses.includes("a verifier")) {
    return "a verifier"
  }

  return "normal"
}

function hasLabMarkerRangeFilter(
  filter: LabMarkerRangeFilter | undefined
): filter is LabMarkerRangeFilter {
  return Boolean(filter?.min.trim() || filter?.max.trim())
}

function emptyLabMarkerRangeFilter(): LabMarkerRangeFilter {
  return {
    min: "",
    max: "",
  }
}

function parseOptionalNumberFilter(value: string) {
  const normalizedValue = value.trim().replace(",", ".")

  if (!normalizedValue) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function parseLabNumericValue(value: string) {
  const match = value.trim().replace(",", ".").match(/-?\d+(?:\.\d+)?/)

  if (!match) {
    return null
  }

  const parsedValue = Number(match[0])
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function AccountStatusBadge({ status }: { status: Account["status"] }) {
  const variant =
    status === "disabled" ? "destructive" : status === "invited" ? "outline" : "secondary"

  return <Badge variant={variant}>{ACCOUNT_STATUS_LABELS[status]}</Badge>
}

function emptyPatientForm(currentService = ""): PatientFormState {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    sex: "",
    address: "",
    apartmentNumber: "",
    phoneNumber: "",
    email: "",
    currentService,
    bedId: "",
    administrativeInfo: "",
  }
}

function emptyVitalForm(): VitalFormState {
  return {
    recordedAt: nowLocalInput(),
    temperature: "37",
    heartRate: "75",
    systolicBloodPressure: "120",
    diastolicBloodPressure: "75",
    oxygenSaturation: "98",
    weight: "70",
    diuresis: "",
    lastStoolDate: todayInput(),
  }
}

function vitalRecordToForm(record: VitalRecord): VitalFormState {
  return {
    recordedAt: dateTimeLocalInput(record.recordedAt),
    temperature: record.temperature.toString(),
    heartRate: record.heartRate.toString(),
    systolicBloodPressure: record.systolicBloodPressure.toString(),
    diastolicBloodPressure: record.diastolicBloodPressure.toString(),
    oxygenSaturation: record.oxygenSaturation.toString(),
    weight: record.weight.toString(),
    diuresis: record.diuresis == null ? "" : record.diuresis.toString(),
    lastStoolDate: dateInput(record.lastStoolDate),
  }
}

function vitalFormToInput(form: VitalFormState) {
  return {
    recordedAt: form.recordedAt,
    temperature: Number(form.temperature),
    heartRate: Number(form.heartRate),
    systolicBloodPressure: Number(form.systolicBloodPressure),
    diastolicBloodPressure: Number(form.diastolicBloodPressure),
    oxygenSaturation: Number(form.oxygenSaturation),
    weight: Number(form.weight),
    diuresis:
      form.diuresis.trim() === "" ? undefined : Number(form.diuresis),
    lastStoolDate: form.lastStoolDate,
  }
}

function emptyPrescriptionForm(): PrescriptionFormState {
  return {
    medications: [emptyPrescriptionMedicationForm()],
    startDate: todayInput(),
    endDate: "",
    status: "active",
  }
}

function emptyPrescriptionMedicationForm(): PrescriptionMedicationFormState {
  return {
    medicineId: "",
    medication: "",
    medicationQuery: "",
    dosage: "",
    frequency: "",
    route: "",
  }
}

function trimPrescriptionMedicationForm(
  medication: PrescriptionMedicationFormState
): PrescriptionMedicationFormState {
  return {
    medicineId: medication.medicineId.trim(),
    medication: medication.medication.trim(),
    medicationQuery: medication.medicationQuery.trim(),
    dosage: medication.dosage.trim(),
    frequency: medication.frequency.trim(),
    route: medication.route.trim(),
  }
}

function defaultMedicineRoute(medicine: Medicine) {
  return (
    medicine.administrationRoutes
      .split(";")
      .map((route) => route.trim())
      .find(Boolean) ?? ""
  )
}

function defaultMedicineDosage(medicine: Medicine) {
  const dosageSummary = medicine.dosageSummary.trim()

  if (dosageSummary) {
    return dosageSummary
  }

  return extractMedicineDosage(medicine.name)
}

function extractMedicineDosage(name: string) {
  return (
    name.match(
      /\b\d+(?:[,.]\d+)?\s*(?:microgrammes?|mg|g|ml|ui|u\.i\.|%)\b/i
    )?.[0] ?? ""
  )
}

function emptyPrescriptionFilters(): PrescriptionFilters {
  return {
    medication: "",
    prescriber: "",
    route: "",
    startDateFrom: "",
    startDateTo: "",
  }
}

function emptyLabForm(
  panelType: LabPanelType = LAB_PANEL_TYPES[0],
  sampledAt = nowLocalInput()
): LabFormState {
  return {
    sampledAt,
    panelType,
    results: labFormResultDefaults(panelType),
  }
}

function labFormResultDefaults(panelType: LabPanelType) {
  return Object.fromEntries(
    labPanelDefinition(panelType).markers.map((marker) => [
      marker.key,
      defaultLabFormResult(),
    ])
  ) as Record<string, LabFormResultState>
}

function defaultLabFormResult(): LabFormResultState {
  return {
    value: "",
    status: "normal",
  }
}

function emptyDocumentForm(): DocumentFormState {
  return {
    title: "",
    category: "report",
    storagePath: "",
  }
}

function emptyEvolutionForm(account: Account): EvolutionFormState {
  return {
    service: account.service,
    visitId: `VIS-${todayInput().replaceAll("-", "")}`,
    recordedAt: nowLocalInput(),
    content: "",
  }
}

function emptyAccountForm(service = ""): AccountFormState {
  return {
    name: "",
    email: "",
    role: "doctor",
    service,
    invite: false,
  }
}

function emptyServiceForm(): ServiceFormState {
  return {
    name: "",
  }
}

function emptyBedForm(service = ""): BedFormState {
  return {
    label: "",
    service,
    sortOrder: "",
  }
}

function patientToForm(patient: Patient): PatientFormState {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    birthDate: patient.birthDate,
    sex: patient.sex ?? "",
    address: patient.address ?? "",
    apartmentNumber: patient.apartmentNumber ?? "",
    phoneNumber: patient.phoneNumber ?? "",
    email: patient.email ?? "",
    currentService: patient.currentService,
    bedId: patient.bedId ?? "",
    administrativeInfo: patient.administrativeInfo ?? "",
  }
}

function serviceToForm(service: Service): ServiceFormState {
  return {
    name: service.name,
  }
}

function bedToForm(bed: Bed): BedFormState {
  return {
    label: bed.label,
    service: bed.service,
    sortOrder: bed.sortOrder.toString(),
  }
}

function accountToForm(account: Account): AccountFormState {
  return {
    name: account.name,
    email: account.email,
    role: account.role,
    service: account.service,
    invite: account.status === "invited",
  }
}

function bedFormToInput(form: BedFormState) {
  return {
    label: form.label,
    service: form.service,
    sortOrder:
      form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder),
  }
}

function optionalValue(value: string) {
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

function textIncludes(value: string, filter: string) {
  const normalizedFilter = filter.trim().toLocaleLowerCase()

  if (!normalizedFilter) {
    return true
  }

  return value.toLocaleLowerCase().includes(normalizedFilter)
}

function nullableOptionalValue(value: string) {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function bedLabel(beds: Bed[], bedId?: string | null) {
  if (!bedId) {
    return "Non assigne"
  }

  return bedLabelText(beds.find((bed) => bed.id === bedId) ?? bedId)
}

function bedLabelText(bed: Bed | string) {
  if (typeof bed === "string") {
    return bed
  }

  return bed.service ? `${bed.label} - ${bed.service}` : bed.label
}

function panelHasValues(panel: VitalChartPanel) {
  return panel.lines.some((line) =>
    panel.data.some((point) => numericChartValue(point[line.dataKey]) !== null)
  )
}

function chartDomain(panel: VitalChartPanel): [number, number] {
  const values = panel.data.flatMap((point) =>
    panel.lines
      .map((line) => numericChartValue(point[line.dataKey]))
      .filter((value): value is number => value !== null)
  )

  if (values.length === 0) {
    return [0, 1]
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min
  const padding =
    spread > 0 ? spread * 0.24 : Math.max(Math.abs(max) * 0.08, 1)

  return [roundDomainValue(min - padding), roundDomainValue(max + padding)]
}

function roundDomainValue(value: number) {
  return Math.round(value * 10) / 10
}

function numericChartValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatChartPointValue(value: unknown, decimals: number) {
  const numericValue = numericChartValue(value)

  if (numericValue === null) {
    return ""
  }

  return numericValue.toFixed(decimals)
}

function formatChartTooltipValue(value: unknown, unit: string, decimals: number) {
  const formattedValue = formatChartPointValue(value, decimals)

  if (!formattedValue) {
    return "-"
  }

  return unit ? `${formattedValue} ${unit}` : formattedValue
}

const DATE_TEXT_INPUT_TITLE = "Format attendu : jj-mm-aaaa"
const DATE_TIME_TEXT_INPUT_TITLE = "Format attendu : jj-mm-aaaa HH:mm"
const ISO_DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/
const ISO_DATE_TIME_VALUE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
const DATE_TEXT_VALUE_PATTERN = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
const DATE_TIME_TEXT_VALUE_PATTERN =
  /^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2})[:h](\d{1,2})$/

function formatDateTextDraftValue(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

function formatDateTimeTextDraftValue(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 12)
  const date = formatDateTextDraftValue(digits.slice(0, 8))

  if (digits.length <= 8) {
    return date
  }

  const timeDigits = digits.slice(8)

  if (timeDigits.length <= 2) {
    return `${date} ${timeDigits}`
  }

  return `${date} ${timeDigits.slice(0, 2)}:${timeDigits.slice(2)}`
}

function formatDateTextInputValue(value: string) {
  const parts = isoDateParts(value)

  if (!parts) {
    return value
  }

  return `${padDatePart(parts.day)}-${padDatePart(parts.month)}-${padDatePart(
    parts.year,
    4
  )}`
}

function formatDateTimeTextInputValue(value: string) {
  const match = value.match(ISO_DATE_TIME_VALUE_PATTERN)

  if (!match) {
    return value
  }

  const [, year, month, day, hour, minute] = match
  return `${day}-${month}-${year} ${hour}:${minute}`
}

function parseDateTextInputValue(value: string) {
  const match = value.trim().match(DATE_TEXT_VALUE_PATTERN)

  if (!match) {
    return null
  }

  const [, dayValue, monthValue, yearValue] = match
  const day = Number(dayValue)
  const month = Number(monthValue)
  const year = Number(yearValue)

  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return `${padDatePart(year, 4)}-${padDatePart(month)}-${padDatePart(day)}`
}

function parseDateTimeTextInputValue(value: string) {
  const match = value.trim().match(DATE_TIME_TEXT_VALUE_PATTERN)

  if (!match) {
    return null
  }

  const [, dayValue, monthValue, yearValue, hourValue, minuteValue] = match
  const day = Number(dayValue)
  const month = Number(monthValue)
  const year = Number(yearValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)

  if (
    !isValidDateParts(year, month, day) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return `${padDatePart(year, 4)}-${padDatePart(month)}-${padDatePart(
    day
  )}T${padDatePart(hour)}:${padDatePart(minute)}`
}

function isoDateParts(value: string) {
  const match = value.match(ISO_DATE_VALUE_PATTERN)

  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)

  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return { day, month, year }
}

function dateFromIsoValue(value: string) {
  const parts = isoDateParts(value)

  if (!parts) {
    return null
  }

  return new Date(parts.year, parts.month - 1, parts.day)
}

function isoDateFromDate(date: Date) {
  return `${padDatePart(date.getFullYear(), 4)}-${padDatePart(
    date.getMonth() + 1
  )}-${padDatePart(date.getDate())}`
}

function timeFromIsoDateTime(value: string) {
  const match = value.match(ISO_DATE_TIME_VALUE_PATTERN)

  if (!match) {
    return "00:00"
  }

  const [, , , , hour, minute] = match
  return `${hour}:${minute}`
}

function isValidDateParts(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false
  }

  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function padDatePart(value: number, length = 2) {
  return value.toString().padStart(length, "0")
}

function dateTimeLocalInput(value: string) {
  if (!value) {
    return nowLocalInput()
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16)
  }

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function dateInput(value: string) {
  if (!value) {
    return todayInput()
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function nowLocalInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function todayInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function realtimePageForPatientTab(tab: PatientTab) {
  return tab === "summary" ? "patient" : tab
}

function formatDate(value: string) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("fr-FR").format(date)
}

function patientSexLabel(sex?: PatientSex | null) {
  return sex ? PATIENT_SEX_LABELS[sex] ?? sex : "Non renseigne"
}

function formatShortDateTime(value: string) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ")
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function evolutionNoteDate(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatEvolutionNoteDay(value: string) {
  const date = evolutionNoteDate(value)

  if (!date) {
    return "--"
  }

  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date)
}

function formatEvolutionNoteMonth(value: string) {
  const date = evolutionNoteDate(value)

  if (!date) {
    return value.replace("T", " ").split(" ")[0] || "-"
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatEvolutionNoteTime(value: string) {
  const date = evolutionNoteDate(value)

  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} o`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function filenameFromDisposition(disposition: string | null) {
  return disposition?.match(/filename="([^"]+)"/)?.[1]
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "unauthorized") {
      return "Identifiants invalides ou session expiree"
    }

    return error.message
  }

  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Serveur Hospitalinator indisponible"
    }

    return error.message
  }

  return "Operation impossible"
}

export default App
