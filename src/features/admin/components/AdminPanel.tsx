import { useCallback, useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  ArrowLeft,
  Ban,
  BedIcon,
  Building2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react"
import { Navigate, useLocation, useNavigate } from "react-router"

import {
  assignRole,
  createAccount,
  createBed,
  createRoom,
  createService,
  deleteBed,
  deleteService,
  disableAccount,
  getAccount,
  listAccounts,
  listBeds,
  listPatients,
  listRooms,
  listServices,
  resetAccountPassword,
  updateAccount,
  updateBed,
  updateRoom,
  updateService,
} from "@/api"
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from "@/app/constants"
import { errorMessage } from "@/app/error-utils"
import {
  accountToForm,
  bedFormToInput,
  emptyAccountForm,
  emptyRoomForm,
  emptyServiceForm,
  roomFormToInput,
  roomToForm,
  serviceToForm,
} from "@/app/form-state"
import type {
  AccountFormState,
  RoomFormState,
  ServiceFormState,
} from "@/app/types"
import { AlertMessage, EmptyState } from "@/components/common/Feedback"
import { Field } from "@/components/common/Field"
import { ServiceSelect } from "@/components/common/FormControls"
import { SectionTitle } from "@/components/common/SectionTitle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import type { Account, Bed, Patient, Room, Service, UserRole } from "@/types"

const ALL_SERVICES = "__all_services__"
const ALL_ROLES = "__all_roles__"

type RoomWithBeds = Room & { beds: Bed[] }

type AdminView =
  | { type: "home" }
  | { type: "personnel" }
  | { type: "rooms" }
  | { type: "room-edit"; roomId: string }
  | { type: "services" }
  | { type: "service-detail"; serviceId: string }
  | { type: "service-room-edit"; serviceId: string; roomId: string }
  | { type: "unknown" }

export function AdminPanel({
  onCatalogChanged,
}: {
  onCatalogChanged: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const view = parseAdminView(location.pathname)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [includeDisabled, setIncludeDisabled] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<AccountFormState>(
    emptyAccountForm()
  )
  const [editForm, setEditForm] = useState<AccountFormState>(emptyAccountForm())
  const [createServiceForm, setCreateServiceForm] = useState<ServiceFormState>(
    emptyServiceForm()
  )
  const [roomEditForm, setRoomEditForm] = useState<RoomFormState>(
    emptyRoomForm()
  )
  const [roomBedLabels, setRoomBedLabels] = useState<string[]>([])
  const [personnelSearch, setPersonnelSearch] = useState("")
  const [personnelService, setPersonnelService] = useState(ALL_SERVICES)
  const [personnelRole, setPersonnelRole] = useState(ALL_ROLES)
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [patientLoading, setPatientLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const defaultServiceName = services[0]?.name ?? ""
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId
  )
  const activeService =
    view.type === "service-detail" || view.type === "service-room-edit"
      ? services.find((service) => service.id === view.serviceId)
      : null
  const editedRoom =
    view.type === "room-edit" || view.type === "service-room-edit"
      ? rooms.find((room) => room.id === view.roomId)
      : null
  const editedRoomBeds = useMemo(
    () =>
      editedRoom
        ? beds
            .filter((bed) => bed.roomId === editedRoom.id)
            .sort(compareBeds)
        : [],
    [beds, editedRoom]
  )
  const filteredAccounts = useMemo(() => {
    const query = personnelSearch.trim().toLocaleLowerCase()

    return accounts.filter((account) => {
      const matchesSearch =
        !query ||
        account.name.toLocaleLowerCase().includes(query) ||
        account.email.toLocaleLowerCase().includes(query)
      const matchesService =
        personnelService === ALL_SERVICES || account.service === personnelService
      const matchesRole =
        personnelRole === ALL_ROLES || account.role === personnelRole

      return matchesSearch && matchesService && matchesRole
    })
  }, [accounts, personnelRole, personnelSearch, personnelService])

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
      const [serviceResult, roomResult, bedResult] = await Promise.all([
        listServices(),
        listRooms(),
        listBeds(),
      ])
      const firstServiceName = serviceResult[0]?.name ?? ""
      setServices(serviceResult)
      setRooms(roomResult)
      setBeds(bedResult)
      setCreateForm((current) =>
        current.service || !firstServiceName
          ? current
          : { ...current, service: firstServiceName }
      )
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  const loadPatients = useCallback(async () => {
    setPatientLoading(true)

    try {
      setPatients(await listPatients())
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setPatientLoading(false)
    }
  }, [])

  const refreshAll = useCallback(() => {
    void loadAccounts()
    void loadCatalog()
    void loadPatients()
  }, [loadAccounts, loadCatalog, loadPatients])

  useEffect(() => {
    const timeout = window.setTimeout(refreshAll, 0)

    return () => window.clearTimeout(timeout)
  }, [refreshAll])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!selectedAccountId) {
        setEditForm(emptyAccountForm(defaultServiceName))
        return
      }

      getAccount(selectedAccountId)
        .then((account) => setEditForm(accountToForm(account)))
        .catch((loadError) => setError(errorMessage(loadError)))
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [defaultServiceName, selectedAccountId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!editedRoom) {
        setRoomEditForm(emptyRoomForm(defaultServiceName))
        setRoomBedLabels([])
        return
      }

      setRoomEditForm(roomToForm(editedRoom))
      setRoomBedLabels(
        editedRoomBeds.map((bed, index) => bed.label || `${index + 1}`)
      )
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [defaultServiceName, editedRoom, editedRoomBeds])

  async function runAdminAction(action: () => Promise<void>, okMessage: string) {
    setError("")
    setSuccess("")
    setGeneratedPassword("")

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
    }, "Compte créé")
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
    }, "Compte mis à jour")
  }

  async function handleAssignRole() {
    if (!selectedAccountId) {
      return
    }

    await runAdminAction(async () => {
      await assignRole(selectedAccountId, editForm.role)
      await loadAccounts()
    }, "Poste affecté")
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
    }, "Mot de passe régénéré")
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAdminAction(async () => {
      const service = await createService({ name: createServiceForm.name })
      setCreateServiceForm(emptyServiceForm())
      await loadCatalog()
      onCatalogChanged()
      navigate(`/admin/services/${service.id}`)
    }, "Service créé")
  }

  async function handleUpdateService(
    event: FormEvent<HTMLFormElement>,
    service: Service,
    form: ServiceFormState
  ) {
    event.preventDefault()
    await runAdminAction(async () => {
      await updateService(service.id, { name: form.name })
      await Promise.all([loadCatalog(), loadAccounts(), loadPatients()])
      onCatalogChanged()
    }, "Service mis à jour")
  }

  async function handleDeleteService(service: Service) {
    const confirmed = window.confirm(`Supprimer le service ${service.name} ?`)

    if (!confirmed) {
      return
    }

    await runAdminAction(async () => {
      await deleteService(service.id)
      await loadCatalog()
      onCatalogChanged()
      navigate("/admin/services")
    }, "Service supprimé")
  }

  async function handleCreateRoom() {
    await runAdminAction(async () => {
      const service = defaultServiceName
      const serviceRooms = rooms.filter((room) => room.service === service)
      const room = await createRoom({
        label: nextRoomDraftLabel(serviceRooms),
        service,
        sortOrder: nextRoomSortOrder(serviceRooms),
      })
      await loadCatalog()
      onCatalogChanged()
      navigate(`/admin/chambres/${room.id}`)
    }, "Chambre créée")
  }

  async function handleSaveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editedRoom) {
      return
    }

    await runAdminAction(async () => {
      const desiredLabels = roomBedLabels.map((label, index) => {
        const trimmed = label.trim()
        return trimmed || `${index + 1}`
      })
      const existingBeds = editedRoomBeds
      const removedBeds = existingBeds.slice(desiredLabels.length)
      const occupiedRemovedBed = removedBeds.find((bed) => bed.occupiedPatientId)

      if (occupiedRemovedBed) {
        throw new Error(
          `Impossible de supprimer le lit ${occupiedRemovedBed.label}: un patient y est assigné`
        )
      }

      await updateRoom(editedRoom.id, roomFormToInput(roomEditForm))

      await Promise.all(
        desiredLabels.slice(0, existingBeds.length).map((label, index) => {
          const bed = existingBeds[index]
          return updateBed(
            bed.id,
            bedFormToInput({
              label,
              roomId: editedRoom.id,
              sortOrder: `${index + 1}`,
            })
          )
        })
      )

      await Promise.all(
        desiredLabels.slice(existingBeds.length).map((label, index) =>
          createBed({
            label,
            roomId: editedRoom.id,
            sortOrder: existingBeds.length + index + 1,
          })
        )
      )

      for (const bed of removedBeds.reverse()) {
        await deleteBed(bed.id)
      }

      await loadCatalog()
      onCatalogChanged()
    }, "Chambre mise à jour")
  }

  function setRoomBedCount(nextCount: number) {
    const count = Number.isFinite(nextCount) ? Math.max(0, nextCount) : 0
    setRoomBedLabels((current) => {
      if (count <= current.length) {
        return current.slice(0, count)
      }

      return [
        ...current,
        ...Array.from({ length: count - current.length }, (_, index) =>
          `${current.length + index + 1}`
        ),
      ]
    })
  }

  const adminActions = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={includeDisabled}
          onChange={(event) => setIncludeDisabled(event.target.checked)}
        />
        Suspendus
      </label>
      <Button type="button" variant="outline" onClick={refreshAll}>
        <RefreshCw
          className={cn(
            "size-4",
            (loading || catalogLoading || patientLoading) && "animate-spin"
          )}
        />
        Actualiser
      </Button>
    </div>
  )

  if (view.type === "unknown") {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="space-y-5">
      <AdminHeader actions={adminActions} view={view} />

      {error && <AlertMessage message={error} />}
      {success && <AlertMessage tone="success" message={success} />}
      {generatedPassword && (
        <AlertMessage
          tone="success"
          message={`Mot de passe généré: ${generatedPassword}`}
        />
      )}

      {view.type === "home" && (
        <AdminHome
          accounts={accounts}
          beds={beds}
          patients={patients}
          rooms={rooms}
          services={services}
          onOpen={(path) => navigate(path)}
        />
      )}

      {view.type === "personnel" && (
        <PersonnelPage
          accounts={accounts}
          createForm={createForm}
          editForm={editForm}
          filteredAccounts={filteredAccounts}
          includeDisabled={includeDisabled}
          loading={loading}
          personnelRole={personnelRole}
          personnelSearch={personnelSearch}
          personnelService={personnelService}
          selectedAccount={selectedAccount}
          selectedAccountId={selectedAccountId}
          services={services}
          onAssignRole={() => void handleAssignRole()}
          onCreateAccount={(event) => void handleCreateAccount(event)}
          onDisableAccount={() => void handleDisableAccount()}
          onResetPassword={() => void handleResetPassword()}
          onSelectAccount={setSelectedAccountId}
          onSetCreateForm={setCreateForm}
          onSetEditForm={setEditForm}
          onSetPersonnelRole={setPersonnelRole}
          onSetPersonnelSearch={setPersonnelSearch}
          onSetPersonnelService={setPersonnelService}
          onUpdateAccount={(event) => void handleUpdateAccount(event)}
        />
      )}

      {view.type === "rooms" && (
        <RoomsPage
          beds={beds}
          rooms={rooms}
          services={services}
          onCreateRoom={() => void handleCreateRoom()}
          onEditRoom={(roomId) => navigate(`/admin/chambres/${roomId}`)}
        />
      )}

      {(view.type === "room-edit" || view.type === "service-room-edit") && (
        <RoomEditorPage
          bedLabels={roomBedLabels}
          beds={editedRoomBeds}
          form={roomEditForm}
          room={editedRoom}
          services={services}
          onBack={() => navigate(-1)}
          onBedCountChange={setRoomBedCount}
          onBedLabelChange={(index, label) =>
            setRoomBedLabels((current) =>
              current.map((currentLabel, currentIndex) =>
                currentIndex === index ? label : currentLabel
              )
            )
          }
          onChange={setRoomEditForm}
          onSubmit={(event) => void handleSaveRoom(event)}
        />
      )}

      {view.type === "services" && (
        <ServicesPage
          accounts={accounts}
          beds={beds}
          createServiceForm={createServiceForm}
          patients={patients}
          rooms={rooms}
          services={services}
          onCreateService={(event) => void handleCreateService(event)}
          onOpenService={(serviceId) => navigate(`/admin/services/${serviceId}`)}
          onSetCreateServiceForm={setCreateServiceForm}
        />
      )}

      {view.type === "service-detail" && (
        <ServiceDetailPage
          accounts={accounts}
          beds={beds}
          patients={patients}
          rooms={rooms}
          service={activeService}
          onBack={() => navigate("/admin/services")}
          onDeleteService={(service) => void handleDeleteService(service)}
          onEditRoom={(roomId) =>
            navigate(`/admin/services/${activeService?.id}/chambres/${roomId}`)
          }
          onUpdateService={(event, service, form) =>
            void handleUpdateService(event, service, form)
          }
        />
      )}
    </div>
  )
}

function AdminHeader({
  actions,
  view,
}: {
  actions: ReactNode
  view: AdminView
}) {
  const navigate = useNavigate()
  const title =
    view.type === "personnel"
      ? "Personnel"
      : view.type === "rooms" || view.type === "room-edit"
        ? "Chambres"
        : view.type === "services" ||
            view.type === "service-detail" ||
            view.type === "service-room-edit"
          ? "Services"
          : "Administration"

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {view.type !== "home" && (
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={() => navigate("/admin")}
            aria-label="Retour à l'administration"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-heading text-2xl font-medium">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Gestion opérationnelle de l'hôpital
          </p>
        </div>
      </div>
      {actions}
    </div>
  )
}

function AdminHome({
  accounts,
  beds,
  patients,
  rooms,
  services,
  onOpen,
}: {
  accounts: Account[]
  beds: Bed[]
  patients: Patient[]
  rooms: Room[]
  services: Service[]
  onOpen: (path: string) => void
}) {
  const occupiedBeds = beds.filter((bed) => bed.occupiedPatientId).length
  const activePatients = patients.filter((patient) => patient.currentVisitId).length

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AdminLandingCard
        icon={Users}
        title="Personnel"
        detail={`${accounts.length} membre${accounts.length > 1 ? "s" : ""}`}
        stats={[
          `${services.length} service${services.length > 1 ? "s" : ""}`,
          `${accounts.filter((account) => account.status === "active").length} actifs`,
        ]}
        onClick={() => onOpen("/admin/personnel")}
      />
      <AdminLandingCard
        icon={BedIcon}
        title="Chambres"
        detail={`${rooms.length} chambre${rooms.length > 1 ? "s" : ""}`}
        stats={[
          `${occupiedBeds}/${beds.length} lits occupés`,
          `${beds.length} lit${beds.length > 1 ? "s" : ""}`,
        ]}
        onClick={() => onOpen("/admin/chambres")}
      />
      <AdminLandingCard
        icon={Building2}
        title="Services"
        detail={`${services.length} service${services.length > 1 ? "s" : ""}`}
        stats={[
          `${activePatients} patient${activePatients > 1 ? "s" : ""} en visite`,
          `${rooms.length} chambres`,
        ]}
        onClick={() => onOpen("/admin/services")}
      />
    </div>
  )
}

function AdminLandingCard({
  detail,
  icon: Icon,
  onClick,
  stats,
  title,
}: {
  detail: string
  icon: typeof Users
  onClick: () => void
  stats: string[]
  title: string
}) {
  return (
    <button
      type="button"
      className="flex min-h-60 flex-col justify-between rounded-lg border bg-background p-5 text-left shadow transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      <span className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-7" />
      </span>
      <span>
        <span className="block font-heading text-2xl font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {detail}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <Badge key={stat} variant="secondary">
            {stat}
          </Badge>
        ))}
      </span>
    </button>
  )
}

function PersonnelPage({
  createForm,
  editForm,
  filteredAccounts,
  loading,
  personnelRole,
  personnelSearch,
  personnelService,
  selectedAccount,
  selectedAccountId,
  services,
  onAssignRole,
  onCreateAccount,
  onDisableAccount,
  onResetPassword,
  onSelectAccount,
  onSetCreateForm,
  onSetEditForm,
  onSetPersonnelRole,
  onSetPersonnelSearch,
  onSetPersonnelService,
  onUpdateAccount,
}: {
  accounts: Account[]
  createForm: AccountFormState
  editForm: AccountFormState
  filteredAccounts: Account[]
  includeDisabled: boolean
  loading: boolean
  personnelRole: string
  personnelSearch: string
  personnelService: string
  selectedAccount: Account | undefined
  selectedAccountId: string | null
  services: Service[]
  onAssignRole: () => void
  onCreateAccount: (event: FormEvent<HTMLFormElement>) => void
  onDisableAccount: () => void
  onResetPassword: () => void
  onSelectAccount: (accountId: string) => void
  onSetCreateForm: (form: AccountFormState) => void
  onSetEditForm: (form: AccountFormState) => void
  onSetPersonnelRole: (role: string) => void
  onSetPersonnelSearch: (search: string) => void
  onSetPersonnelService: (service: string) => void
  onUpdateAccount: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="rounded-lg border bg-background p-4 shadow">
        <div className="grid gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="size-4 shrink-0 text-primary" />
            <h3 className="truncate font-heading text-lg font-medium">
              Liste du personnel
            </h3>
          </div>
          <div className="grid w-full max-w-3xl gap-2 md:grid-cols-[minmax(14rem,1fr)_minmax(11rem,13rem)_minmax(11rem,13rem)]">
            <div className="flex h-9 min-w-0 items-center rounded-lg border border-input/60 bg-background shadow-inner shadow-muted/60 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20">
              <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
              <Input
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0 md:text-sm"
                placeholder="Rechercher par nom"
                value={personnelSearch}
                onChange={(event) => onSetPersonnelSearch(event.target.value)}
              />
            </div>
            <Select
              value={personnelService}
              onValueChange={onSetPersonnelService}
            >
              <SelectTrigger className="h-9 max-w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SERVICES}>Tous les services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.name}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={personnelRole} onValueChange={onSetPersonnelRole}>
              <SelectTrigger className="h-9 max-w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>Tous les postes</SelectItem>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Courriel</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow
                  key={account.id}
                  className={cn(
                    "cursor-pointer",
                    selectedAccountId === account.id && "bg-primary/5"
                  )}
                  onClick={() => onSelectAccount(account.id)}
                >
                  <TableCell className="font-medium">{account.name}</TableCell>
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
        </div>
        {filteredAccounts.length === 0 && (
          <EmptyState
            label={loading ? "Chargement du personnel" : "Aucun membre trouvé"}
          />
        )}
      </div>

      <div className="space-y-4">
        <form
          className="grid gap-3 rounded-lg border bg-background p-4 shadow"
          onSubmit={onCreateAccount}
        >
          <SectionTitle icon={UserPlus} title="Nouveau membre" />
          <AccountFields
            form={createForm}
            services={services}
            onChange={onSetCreateForm}
            invite
          />
          <Button type="submit" disabled={services.length === 0}>
            <UserPlus className="size-4" />
            Créer
          </Button>
        </form>

        <form
          className="grid gap-3 rounded-lg border bg-background p-4 shadow"
          onSubmit={onUpdateAccount}
        >
          <SectionTitle icon={UserCog} title="Membre sélectionné" />
          {selectedAccount ? (
            <>
              <AccountFields
                form={editForm}
                services={services}
                onChange={onSetEditForm}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="submit">
                  <Save className="size-4" />
                  Enregistrer
                </Button>
                <Button type="button" variant="outline" onClick={onAssignRole}>
                  <ShieldCheck className="size-4" />
                  Affecter poste
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetPassword}
                >
                  <KeyRound className="size-4" />
                  Mot de passe
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={selectedAccount.status === "disabled"}
                  onClick={onDisableAccount}
                >
                  <Ban className="size-4" />
                  Suspendre
                </Button>
              </div>
            </>
          ) : (
            <EmptyState label="Aucun membre sélectionné" />
          )}
        </form>
      </div>
    </section>
  )
}

function RoomsPage({
  beds,
  rooms,
  services,
  onCreateRoom,
  onEditRoom,
}: {
  beds: Bed[]
  rooms: Room[]
  services: Service[]
  onCreateRoom: () => void
  onEditRoom: (roomId: string) => void
}) {
  return (
    <section>
      <AdminRoomGrid
        beds={beds}
        canCreateRoom={services.length > 0}
        rooms={rooms}
        serviceName=""
        onCreateRoom={onCreateRoom}
        onEditRoom={onEditRoom}
      />
    </section>
  )
}

function RoomEditorPage({
  bedLabels,
  beds,
  form,
  room,
  services,
  onBack,
  onBedCountChange,
  onBedLabelChange,
  onChange,
  onSubmit,
}: {
  bedLabels: string[]
  beds: Bed[]
  form: RoomFormState
  room: Room | null | undefined
  services: Service[]
  onBack: () => void
  onBedCountChange: (count: number) => void
  onBedLabelChange: (index: number, label: string) => void
  onChange: (form: RoomFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (!room) {
    return <EmptyState label="Chambre introuvable" />
  }

  return (
    <form
      className="mx-auto grid max-w-3xl gap-4 rounded-lg border bg-background p-4 shadow"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle icon={BedIcon} title={`Chambre ${room.label}`} />
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Retour
        </Button>
      </div>
      <RoomFields form={form} services={services} onChange={onChange} />
      <Field label="Nombre de lits" required>
        <Input
          required
          type="number"
          min="0"
          step="1"
          value={bedLabels.length}
          onChange={(event) => onBedCountChange(Number(event.target.value))}
        />
      </Field>
      <div className="grid gap-2">
        {bedLabels.map((label, index) => {
          const bed = beds[index]
          const occupied = Boolean(bed?.occupiedPatientId)

          return (
            <Field
              key={`${bed?.id ?? "new"}-${index}`}
              label={`Nom du lit ${index + 1}${occupied ? " occupé" : ""}`}
            >
              <Input
                value={label}
                onChange={(event) => onBedLabelChange(index, event.target.value)}
              />
            </Field>
          )
        })}
      </div>
      <Button type="submit">
        <Save className="size-4" />
        Enregistrer la chambre
      </Button>
    </form>
  )
}

function ServicesPage({
  accounts,
  beds,
  createServiceForm,
  patients,
  rooms,
  services,
  onCreateService,
  onOpenService,
  onSetCreateServiceForm,
}: {
  accounts: Account[]
  beds: Bed[]
  createServiceForm: ServiceFormState
  patients: Patient[]
  rooms: Room[]
  services: Service[]
  onCreateService: (event: FormEvent<HTMLFormElement>) => void
  onOpenService: (serviceId: string) => void
  onSetCreateServiceForm: (form: ServiceFormState) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            accounts={accounts}
            beds={beds}
            patients={patients}
            rooms={rooms}
            service={service}
            onClick={() => onOpenService(service.id)}
          />
        ))}
        {services.length === 0 && <EmptyState label="Aucun service" />}
      </div>
      <form
        className="grid content-start gap-3 rounded-lg border bg-background p-4 shadow"
        onSubmit={onCreateService}
      >
        <SectionTitle icon={Plus} title="Nouveau service" />
        <Field label="Nom" required>
          <Input
            required
            value={createServiceForm.name}
            onChange={(event) =>
              onSetCreateServiceForm({ name: event.target.value })
            }
          />
        </Field>
        <Button type="submit">
          <Plus className="size-4" />
          Créer
        </Button>
      </form>
    </section>
  )
}

function ServiceDetailPage({
  accounts,
  beds,
  patients,
  rooms,
  service,
  onBack,
  onDeleteService,
  onEditRoom,
  onUpdateService,
}: {
  accounts: Account[]
  beds: Bed[]
  patients: Patient[]
  rooms: Room[]
  service: Service | null | undefined
  onBack: () => void
  onDeleteService: (service: Service) => void
  onEditRoom: (roomId: string) => void
  onUpdateService: (
    event: FormEvent<HTMLFormElement>,
    service: Service,
    form: ServiceFormState
  ) => void
}) {
  if (!service) {
    return <EmptyState label="Service introuvable" />
  }

  return (
    <ServiceDetailContent
      key={`${service.id}:${service.name}`}
      accounts={accounts}
      beds={beds}
      patients={patients}
      rooms={rooms}
      service={service}
      onBack={onBack}
      onDeleteService={onDeleteService}
      onEditRoom={onEditRoom}
      onUpdateService={onUpdateService}
    />
  )
}

function ServiceDetailContent({
  accounts,
  beds,
  patients,
  rooms,
  service,
  onBack,
  onDeleteService,
  onEditRoom,
  onUpdateService,
}: {
  accounts: Account[]
  beds: Bed[]
  patients: Patient[]
  rooms: Room[]
  service: Service
  onBack: () => void
  onDeleteService: (service: Service) => void
  onEditRoom: (roomId: string) => void
  onUpdateService: (
    event: FormEvent<HTMLFormElement>,
    service: Service,
    form: ServiceFormState
  ) => void
}) {
  const [form, setForm] = useState<ServiceFormState>(() =>
    serviceToForm(service)
  )
  const serviceRooms = rooms.filter((room) => room.service === service.name)
  const serviceBeds = beds.filter((bed) => bed.service === service.name)
  const occupiedBeds = occupiedBedCount(serviceBeds)
  const serviceAccounts = accounts.filter(
    (account) => account.service === service.name
  )

  return (
    <div className="space-y-4">
      <form
        className="grid gap-4 rounded-lg border bg-background p-4 shadow"
        onSubmit={(event) => onUpdateService(event, service, form)}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle icon={Building2} title={service.name} />
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Services
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <Field label="Nom du service" required>
            <Input
              required
              value={form.name}
              onChange={(event) => setForm({ name: event.target.value })}
            />
          </Field>
          <Button type="submit">
            <Save className="size-4" />
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onDeleteService(service)}
          >
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <StatBox
            label="Patients en visite"
            value={servicePatientsInVisit(patients, service.name)}
          />
          <StatBox
            label="Lits occupés"
            value={`${occupiedBeds}/${serviceBeds.length}`}
            occupancyRatio={occupancyRatio(occupiedBeds, serviceBeds.length)}
          />
          <StatBox label="Chambres" value={serviceRooms.length} />
          <StatBox label="Personnel" value={serviceAccounts.length} />
        </div>
      </form>

      <AdminRoomGrid
        beds={serviceBeds}
        rooms={serviceRooms}
        serviceName={service.name}
        onEditRoom={onEditRoom}
      />

      <div className="rounded-lg border bg-background p-4 shadow">
        <SectionTitle icon={Users} title="Personnel du service" />
        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Courriel</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{ROLE_LABELS[account.role]}</TableCell>
                  <TableCell>
                    <AccountStatusBadge status={account.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {serviceAccounts.length === 0 && (
          <EmptyState label="Aucun personnel dans ce service" />
        )}
      </div>
    </div>
  )
}

function ServiceCard({
  accounts,
  beds,
  patients,
  rooms,
  service,
  onClick,
}: {
  accounts: Account[]
  beds: Bed[]
  patients: Patient[]
  rooms: Room[]
  service: Service
  onClick: () => void
}) {
  const serviceBeds = beds.filter((bed) => bed.service === service.name)
  const occupiedBeds = occupiedBedCount(serviceBeds)

  return (
    <button
      type="button"
      className="grid min-h-52 gap-4 rounded-lg border bg-background p-5 text-left shadow transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-heading text-xl font-medium">
            {service.name}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {rooms.filter((room) => room.service === service.name).length} chambres ·{" "}
            {accounts.filter((account) => account.service === service.name).length} membres
          </span>
        </span>
        <Building2 className="size-5 shrink-0 text-primary" />
      </span>
      <span className="grid gap-2 sm:grid-cols-2">
        <StatBox
          label="Patients en visite"
          value={servicePatientsInVisit(patients, service.name)}
        />
        <StatBox
          label="Lits occupés"
          value={`${occupiedBeds}/${serviceBeds.length}`}
          occupancyRatio={occupancyRatio(occupiedBeds, serviceBeds.length)}
        />
      </span>
    </button>
  )
}

function AdminRoomGrid({
  beds,
  canCreateRoom = false,
  rooms,
  serviceName,
  onCreateRoom,
  onEditRoom,
}: {
  beds: Bed[]
  canCreateRoom?: boolean
  rooms: Room[]
  serviceName: string
  onCreateRoom?: () => void
  onEditRoom: (roomId: string) => void
}) {
  const groupedRooms = useMemo(() => groupRoomsWithBeds(rooms, beds), [beds, rooms])
  const gridItems = useMemo<Array<RoomWithBeds | null>>(
    () => (onCreateRoom ? [...groupedRooms, null] : groupedRooms),
    [groupedRooms, onCreateRoom]
  )
  const mobileColumns = useMemo(() => distributeGridItems(gridItems, 1), [gridItems])
  const tabletColumns = useMemo(() => distributeGridItems(gridItems, 2), [gridItems])
  const desktopColumns = useMemo(() => distributeGridItems(gridItems, 3), [gridItems])
  const occupiedCount = beds.filter((bed) => bed.occupiedPatientId).length
  const renderColumn = (items: Array<RoomWithBeds | null>, columnIndex: number) => (
    <div key={columnIndex} className="flex min-w-0 flex-col gap-4">
      {items.map((item, itemIndex) =>
        item ? (
          <AdminRoomCard
            key={item.id}
            room={item}
            onEditRoom={onEditRoom}
          />
        ) : (
          <NewRoomPlaceholder
            key={`new-room-${columnIndex}-${itemIndex}`}
            disabled={!canCreateRoom}
            onCreateRoom={onCreateRoom}
          />
        )
      )}
    </div>
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BedIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-medium">
              Chambres{serviceName ? ` du service ${serviceName}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              {occupiedCount} lit{occupiedCount > 1 ? "s" : ""} occupé
              {occupiedCount > 1 ? "s" : ""} sur {beds.length}.
            </p>
          </div>
        </div>
      </div>

      {gridItems.length > 0 ? (
        <>
          <div className="grid gap-4 sm:hidden">
            {mobileColumns.map(renderColumn)}
          </div>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:hidden">
            {tabletColumns.map(renderColumn)}
          </div>
          <div className="hidden gap-4 xl:grid xl:grid-cols-3">
            {desktopColumns.map(renderColumn)}
          </div>
        </>
      ) : (
        <EmptyState label="Aucune chambre" />
      )}
    </section>
  )
}

function AdminRoomCard({
  room,
  onEditRoom,
}: {
  room: RoomWithBeds
  onEditRoom: (roomId: string) => void
}) {
  return (
    <div className="flex min-h-56 flex-col rounded-lg border bg-background p-4 shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-medium">
            Chambre {room.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {room.service} · {room.beds.length} lit
            {room.beds.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">
            {room.beds.filter((bed) => bed.occupiedPatientId).length}/
            {room.beds.length}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={() => onEditRoom(room.id)}
            aria-label={`Modifier la chambre ${room.label}`}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid min-h-0 flex-1 content-start gap-2">
        {room.beds.length > 0 ? (
          room.beds.map((bed) => {
            const occupied = Boolean(bed.occupiedPatientId)
            const occupiedStyle =
              bed.occupiedPatientSex === "female"
                ? "justify-between gap-3 border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-400/40 dark:bg-pink-950/30 dark:text-pink-200"
                : "justify-between gap-3 border-primary/30 bg-primary/10 text-primary"

            return (
              <div
                key={bed.id}
                className={cn(
                  "relative flex h-16 min-w-0 items-center rounded-xl border px-3 text-left text-sm",
                  occupied
                    ? occupiedStyle
                    : "justify-between border-dashed border-input bg-transparent text-muted-foreground"
                )}
              >
                {occupied ? (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        Lit {bed.label}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium">
                        {bed.occupiedPatientName ?? "Patient assigné"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs">Occupé</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-medium">Lit {bed.label}</span>
                    <span className="text-sm font-medium">Libre</span>
                  </>
                )}
              </div>
            )
          })
        ) : (
          <div className="flex h-16 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            Aucun lit
          </div>
        )}
      </div>
    </div>
  )
}

function NewRoomPlaceholder({
  disabled,
  onCreateRoom,
}: {
  disabled: boolean
  onCreateRoom?: () => void
}) {
  return (
    <button
      type="button"
      className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-background/60 p-4 text-center text-muted-foreground shadow-sm transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-background/60 disabled:hover:text-muted-foreground"
      disabled={disabled}
      onClick={onCreateRoom}
      aria-label="Créer une nouvelle chambre"
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-current">
        <Plus className="size-5" />
      </span>
      <span className="font-heading text-base font-medium">
        Nouvelle chambre
      </span>
    </button>
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
      <Field label="Nom" required>
        <Input
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="Courriel" required>
        <Input
          required
          type="email"
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Poste" required>
          <Select
            value={form.role}
            onValueChange={(role) =>
              onChange({ ...form, role: role as UserRole })
            }
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
        <Field label="Service" required>
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
          Marquer comme invité
        </label>
      )}
    </>
  )
}

function RoomFields({
  form,
  services,
  onChange,
}: {
  form: RoomFormState
  services: Service[]
  onChange: (form: RoomFormState) => void
}) {
  return (
    <>
      <Field label="Nom de la chambre" required>
        <Input
          required
          value={form.label}
          onChange={(event) => onChange({ ...form, label: event.target.value })}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Service" required>
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
            min="0"
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

function AccountStatusBadge({ status }: { status: Account["status"] }) {
  const variant =
    status === "disabled"
      ? "destructive"
      : status === "invited"
        ? "outline"
        : "secondary"

  return <Badge variant={variant}>{ACCOUNT_STATUS_LABELS[status]}</Badge>
}

function StatBox({
  label,
  occupancyRatio,
  value,
}: {
  label: string
  occupancyRatio?: number
  value: number | string
}) {
  return (
    <span
      className={cn(
        "rounded-lg border bg-muted/30 p-3 transition-colors",
        occupancyRatio != null && occupancyToneClass(occupancyRatio)
      )}
    >
      <span className="block font-mono text-3xl font-semibold tracking-normal">
        {value}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

function occupancyRatio(occupied: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return occupied / total
}

function occupancyToneClass(ratio: number) {
  if (ratio >= 0.9) {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100"
  }

  if (ratio >= 0.75) {
    return "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-400/40 dark:bg-orange-950/30 dark:text-orange-100"
  }

  if (ratio >= 0.5) {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100"
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-100"
}

function parseAdminView(pathname: string): AdminView {
  const parts = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean)

  if (parts.length === 0) {
    return { type: "home" }
  }

  if (parts[0] === "personnel" && parts.length === 1) {
    return { type: "personnel" }
  }

  if (parts[0] === "chambres" && parts.length === 1) {
    return { type: "rooms" }
  }

  if (parts[0] === "chambres" && parts[1] && parts.length === 2) {
    return { type: "room-edit", roomId: parts[1] }
  }

  if (parts[0] === "services" && parts.length === 1) {
    return { type: "services" }
  }

  if (parts[0] === "services" && parts[1] && parts.length === 2) {
    return { type: "service-detail", serviceId: parts[1] }
  }

  if (
    parts[0] === "services" &&
    parts[1] &&
    parts[2] === "chambres" &&
    parts[3] &&
    parts.length === 4
  ) {
    return { type: "service-room-edit", serviceId: parts[1], roomId: parts[3] }
  }

  return { type: "unknown" }
}

function groupRoomsWithBeds(rooms: Room[], beds: Bed[]): RoomWithBeds[] {
  return [...rooms]
    .sort(
      (left, right) =>
        left.service.localeCompare(right.service) ||
        left.sortOrder - right.sortOrder ||
        left.label.localeCompare(right.label)
    )
    .map((room) => ({
      ...room,
      beds: beds.filter((bed) => bed.roomId === room.id).sort(compareBeds),
    }))
}

function distributeGridItems<T>(items: T[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as T[])

  items.forEach((item, index) => {
    columns[index % columnCount].push(item)
  })

  return columns
}

function nextRoomDraftLabel(rooms: Room[]) {
  const baseLabel = "Nouvelle chambre"
  const existingLabels = new Set(
    rooms.map((room) => room.label.trim().toLocaleLowerCase())
  )

  if (!existingLabels.has(baseLabel.toLocaleLowerCase())) {
    return baseLabel
  }

  let index = 2

  while (existingLabels.has(`${baseLabel} ${index}`.toLocaleLowerCase())) {
    index += 1
  }

  return `${baseLabel} ${index}`
}

function nextRoomSortOrder(rooms: Room[]) {
  const highestSortOrder = Math.max(0, ...rooms.map((room) => room.sortOrder))

  return highestSortOrder + 1
}

function compareBeds(left: Bed, right: Bed) {
  return (
    left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  )
}

function occupiedBedCount(beds: Bed[]) {
  return beds.filter((bed) => bed.occupiedPatientId).length
}

function servicePatientsInVisit(patients: Patient[], serviceName: string) {
  return patients.filter(
    (patient) => patient.currentService === serviceName && patient.currentVisitId
  ).length
}
