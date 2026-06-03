import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  Ban,
  BedIcon,
  Building2,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react"

import {
  assignRole,
  createAccount,
  createBed,
  createRoom,
  createService,
  deleteBed,
  deleteRoom,
  deleteService,
  disableAccount,
  getAccount,
  listAccounts,
  listBeds,
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
  bedToForm,
  emptyAccountForm,
  emptyBedForm,
  emptyRoomForm,
  emptyServiceForm,
  roomFormToInput,
  roomToForm,
  serviceToForm,
} from "@/app/form-state"
import type {
  AccountFormState,
  BedFormState,
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
import type { Account, Bed, Room, Service, UserRole } from "@/types"

export function AdminPanel({
  onCatalogChanged,
}: {
  onCatalogChanged: () => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [includeDisabled, setIncludeDisabled] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
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
  const [createRoomForm, setCreateRoomForm] = useState<RoomFormState>(
    emptyRoomForm()
  )
  const [editRoomForm, setEditRoomForm] = useState<RoomFormState>(
    emptyRoomForm()
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
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId)
  const selectedBed = beds.find((bed) => bed.id === selectedBedId)
  const defaultServiceName = services[0]?.name ?? ""
  const defaultRoomId = rooms[0]?.id ?? ""

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
      const firstRoomId = roomResult[0]?.id ?? ""
      setServices(serviceResult)
      setRooms(roomResult)
      setBeds(bedResult)
      if (firstServiceName) {
        setCreateForm((current) =>
          current.service ? current : { ...current, service: firstServiceName }
        )
        setCreateRoomForm((current) =>
          current.service ? current : { ...current, service: firstServiceName }
        )
      }
      if (firstRoomId) {
        setCreateBedForm((current) =>
          current.roomId ? current : { ...current, roomId: firstRoomId }
        )
      }
      setSelectedServiceId((current) => {
        if (current && serviceResult.some((service) => service.id === current)) {
          return current
        }

        return serviceResult[0]?.id ?? null
      })
      setSelectedRoomId((current) => {
        if (current && roomResult.some((room) => room.id === current)) {
          return current
        }

        return roomResult[0]?.id ?? null
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
      setEditRoomForm(
        selectedRoom ? roomToForm(selectedRoom) : emptyRoomForm(defaultServiceName)
      )
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [defaultServiceName, selectedRoom])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setEditBedForm(
        selectedBed ? bedToForm(selectedBed) : emptyBedForm(defaultRoomId)
      )
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [defaultRoomId, selectedBed])

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

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAdminAction(async () => {
      const room = await createRoom(roomFormToInput(createRoomForm))
      setCreateRoomForm(emptyRoomForm(defaultServiceName))
      await loadCatalog()
      onCatalogChanged()
      setSelectedRoomId(room.id)
    }, "Chambre creee")
  }

  async function handleUpdateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedRoomId) {
      return
    }

    await runAdminAction(async () => {
      await updateRoom(selectedRoomId, roomFormToInput(editRoomForm))
      await loadCatalog()
      onCatalogChanged()
    }, "Chambre mise a jour")
  }

  async function handleDeleteRoom() {
    if (!selectedRoom) {
      return
    }

    const confirmed = window.confirm(`Supprimer la chambre ${selectedRoom.label} ?`)

    if (!confirmed) {
      return
    }

    await runAdminAction(async () => {
      await deleteRoom(selectedRoom.id)
      await loadCatalog()
      onCatalogChanged()
    }, "Chambre supprimee")
  }

  async function handleCreateBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAdminAction(async () => {
      const bed = await createBed(bedFormToInput(createBedForm))
      setCreateBedForm(emptyBedForm(defaultRoomId))
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
      <div className="flex flex-col gap-3 rounded-3xl border bg-background p-4 shadow md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-medium">
            Administration
          </h2>
          <p className="text-sm text-muted-foreground">
            {accounts.length} compte{accounts.length > 1 ? "s" : ""} ·{" "}
            {services.length} service{services.length > 1 ? "s" : ""} ·{" "}
            {rooms.length} chambre{rooms.length > 1 ? "s" : ""} ·{" "}
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
        <div className="rounded-3xl border bg-background p-4 shadow">
          <SectionTitle icon={Building2} title="Services" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Comptes</TableHead>
                <TableHead>Chambres</TableHead>
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
                    {rooms.filter((room) => room.service === service.name).length}
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
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
            onSubmit={handleCreateService}
          >
            <SectionTitle icon={Plus} title="Nouveau service" />
            <Field label="Nom" required>
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
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
            onSubmit={handleUpdateService}
          >
            <SectionTitle icon={Building2} title="Service selectionne" />
            {selectedService ? (
              <>
                <Field label="Nom" required>
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
        <div className="rounded-3xl border bg-background p-4 shadow">
          <SectionTitle icon={Building2} title="Chambres" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libelle</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Lits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow
                  key={room.id}
                  className={selectedRoomId === room.id ? "bg-primary/5" : ""}
                  onClick={() => setSelectedRoomId(room.id)}
                >
                  <TableCell>{room.label}</TableCell>
                  <TableCell>{room.service}</TableCell>
                  <TableCell>
                    {beds.filter((bed) => bed.roomId === room.id).length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rooms.length === 0 && <EmptyState label="Aucune chambre" />}
        </div>

        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
            onSubmit={handleCreateRoom}
          >
            <SectionTitle icon={Plus} title="Nouvelle chambre" />
            <RoomFields
              form={createRoomForm}
              services={services}
              onChange={setCreateRoomForm}
            />
            <Button type="submit" disabled={services.length === 0}>
              <Plus className="size-4" />
              Creer
            </Button>
          </form>

          <form
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
            onSubmit={handleUpdateRoom}
          >
            <SectionTitle icon={Building2} title="Chambre selectionnee" />
            {selectedRoom ? (
              <>
                <RoomFields
                  form={editRoomForm}
                  services={services}
                  onChange={setEditRoomForm}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="submit">
                    <Save className="size-4" />
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={beds.some((bed) => bed.roomId === selectedRoom.id)}
                    onClick={() => void handleDeleteRoom()}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState label="Aucune chambre selectionnee" />
            )}
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border bg-background p-4 shadow">
          <SectionTitle icon={BedIcon} title="Lits" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libelle</TableHead>
                <TableHead>Chambre</TableHead>
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
                  <TableCell>{bed.room}</TableCell>
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
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
            onSubmit={handleCreateBed}
          >
            <SectionTitle icon={Plus} title="Nouveau lit" />
            <BedFields
              form={createBedForm}
              rooms={rooms}
              onChange={setCreateBedForm}
            />
            <Button type="submit" disabled={rooms.length === 0}>
              <Plus className="size-4" />
              Creer
            </Button>
          </form>

          <form
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
            onSubmit={handleUpdateBed}
          >
            <SectionTitle icon={BedIcon} title="Lit selectionne" />
            {selectedBed ? (
              <>
                <BedFields
                  form={editBedForm}
                  rooms={rooms}
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
        <div className="rounded-3xl border bg-background p-4 shadow">
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
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
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
            className="grid gap-3 rounded-3xl border bg-background p-4 shadow"
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
      <div className="grid grid-cols-2 gap-2">
        <Field label="Role" required>
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
          Marquer comme invite
        </label>
      )}
    </>
  )
}

function BedFields({
  form,
  rooms,
  onChange,
}: {
  form: BedFormState
  rooms: Room[]
  onChange: (form: BedFormState) => void
}) {
  return (
    <>
      <Field label="Libelle" required>
        <Input
          required
          value={form.label}
          onChange={(event) => onChange({ ...form, label: event.target.value })}
        />
      </Field>
      <Field label="Chambre" required>
        <Select
          required
          value={form.roomId}
          onValueChange={(roomId) => onChange({ ...form, roomId })}
        >
          <SelectTrigger className="max-w-full">
            <SelectValue placeholder="Selectionner une chambre" />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.label} - {room.service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-2">
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
      <Field label="Libelle" required>
        <Input
          required
          value={form.label}
          onChange={(event) => onChange({ ...form, label: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
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

function AccountStatusBadge({ status }: { status: Account["status"] }) {
  const variant =
    status === "disabled"
      ? "destructive"
      : status === "invited"
        ? "outline"
        : "secondary"

  return <Badge variant={variant}>{ACCOUNT_STATUS_LABELS[status]}</Badge>
}
