import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormReturn,
} from "react-hook-form";
import { LayoutGroup, motion, Reorder, useDragControls } from "motion/react";
import {
  ArrowLeft,
  Ban,
  BedIcon,
  Building2,
  GripVertical,
  KeyRound,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router";

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
  listPatients,
  listRooms,
  listServices,
  resetAccountPassword,
  setRealtimeContext,
  subscribeRealtime,
  updateAccount,
  updateBed,
  updateRoom,
  updateService,
  type RealtimeEvent,
} from "@/api";
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from "@/app/constants";
import { errorMessage } from "@/app/error-utils";
import { validateRequired, validateRequiredEmail } from "@/app/form-validation";
import {
  accountToForm,
  emptyAccountForm,
  emptyServiceForm,
  serviceToForm,
} from "@/app/form-state";
import type { AccountFormState, ServiceFormState } from "@/app/types";
import { AlertMessage, EmptyState } from "@/components/common/Feedback";
import { Field } from "@/components/common/Field";
import { ServiceSelect } from "@/components/common/FormControls";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Account, Bed, Patient, Room, Service, UserRole } from "@/types";

const ALL_SERVICES = "__all_services__";
const ALL_ROLES = "__all_roles__";

type RoomWithBeds = Room & { beds: Bed[] };

type EditableRoomCardModel = {
  id: string;
  persistedId?: string;
  label: string;
  service: string;
  sortOrder: number;
  isDraft: boolean;
  hasChanges?: boolean;
  beds: EditableBedModel[];
};

type EditableBedModel = {
  id: string;
  persistedId?: string;
  label: string;
  sortOrder: number;
  occupiedPatientId?: Bed["occupiedPatientId"];
  occupiedPatientName?: string | null;
  occupiedPatientSex?: Bed["occupiedPatientSex"];
};

type AdminView =
  | { type: "home" }
  | { type: "personnel" }
  | { type: "services" }
  | { type: "service-detail"; serviceId: string }
  | { type: "unknown" };

export function AdminPanel({
  onCatalogChanged,
}: {
  onCatalogChanged: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const view = parseAdminView(location.pathname);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [createForm, setCreateForm] =
    useState<AccountFormState>(emptyAccountForm());
  const [editForm, setEditForm] =
    useState<AccountFormState>(emptyAccountForm());
  const createAccountForm = useForm<AccountFormState>({
    values: createForm,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const editAccountForm = useForm<AccountFormState>({
    values: editForm,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [createServiceForm, setCreateServiceForm] =
    useState<ServiceFormState>(emptyServiceForm());
  const [draftRooms, setDraftRooms] = useState<EditableRoomCardModel[]>([]);
  const [roomDraftOverrides, setRoomDraftOverrides] = useState<
    Record<string, EditableRoomCardModel>
  >({});
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);
  const [roomPendingDeletion, setRoomPendingDeletion] =
    useState<EditableRoomCardModel | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelService, setPersonnelService] = useState(ALL_SERVICES);
  const [personnelRole, setPersonnelRole] = useState(ALL_ROLES);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const defaultServiceName = services[0]?.name ?? "";
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const activeService =
    view.type === "service-detail"
      ? services.find((service) => service.id === view.serviceId)
      : null;
  const filteredAccounts = useMemo(() => {
    const query = personnelSearch.trim().toLocaleLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !query ||
        account.name.toLocaleLowerCase().includes(query) ||
        account.email.toLocaleLowerCase().includes(query);
      const matchesService =
        personnelService === ALL_SERVICES ||
        account.service === personnelService;
      const matchesRole =
        personnelRole === ALL_ROLES || account.role === personnelRole;

      return matchesSearch && matchesService && matchesRole;
    });
  }, [accounts, personnelRole, personnelSearch, personnelService]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listAccounts({ includeDisabled: true });
      setAccounts(result);
      setSelectedAccountId((current) => {
        if (current && result.some((account) => account.id === current)) {
          return current;
        }

        return result[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setError("");

    try {
      const [serviceResult, roomResult, bedResult] = await Promise.all([
        listServices(),
        listRooms(),
        listBeds(),
      ]);
      const firstServiceName = serviceResult[0]?.name ?? "";
      setServices(serviceResult);
      setRooms(roomResult);
      setBeds(bedResult);
      setCreateForm((current) =>
        current.service || !firstServiceName
          ? current
          : { ...current, service: firstServiceName },
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      setPatients(await listPatients());
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  const refreshAll = useCallback(() => {
    void loadAccounts();
    void loadCatalog();
    void loadPatients();
  }, [loadAccounts, loadCatalog, loadPatients]);

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.entity === "account") {
        void loadAccounts();
        return;
      }

      if (event.entity === "service") {
        void Promise.all([loadCatalog(), loadAccounts(), loadPatients()]);
        onCatalogChanged();
        return;
      }

      if (event.entity === "room" || event.entity === "bed") {
        void loadCatalog();
        onCatalogChanged();
        return;
      }

      if (event.entity === "patient") {
        void Promise.all([loadPatients(), loadCatalog()]);
        onCatalogChanged();
      }
    },
    [loadAccounts, loadCatalog, loadPatients, onCatalogChanged],
  );

  useEffect(() => {
    const timeout = window.setTimeout(refreshAll, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshAll]);

  useEffect(() => {
    setRealtimeContext({ page: "admin" });

    return subscribeRealtime(handleRealtimeEvent);
  }, [handleRealtimeEvent]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!selectedAccountId) {
        setEditForm(emptyAccountForm(defaultServiceName));
        return;
      }

      getAccount(selectedAccountId)
        .then((account) => setEditForm(accountToForm(account)))
        .catch((loadError) => setError(errorMessage(loadError)));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [defaultServiceName, selectedAccountId]);

  async function runAdminAction(
    action: () => Promise<void>,
    okMessage: string,
  ) {
    setError("");
    setSuccess("");
    setGeneratedPassword("");

    try {
      await action();
      setSuccess(okMessage);
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError));
      return false;
    }
  }

  async function handleCreateAccount() {
    return await runAdminAction(async () => {
      const result = await createAccount({
        name: createForm.name,
        email: createForm.email,
        role: createForm.role,
        service: createForm.service,
        invite: createForm.invite,
      });
      setGeneratedPassword(result.generatedPassword);
      setCreateForm(emptyAccountForm(defaultServiceName));
      await loadAccounts();
      setSelectedAccountId(result.account.id);
    }, "Compte créé");
  }

  async function handleUpdateAccount() {
    if (!selectedAccountId) {
      return;
    }

    await runAdminAction(async () => {
      await updateAccount(selectedAccountId, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        service: editForm.service,
      });
      await loadAccounts();
    }, "Compte mis à jour");
  }

  async function handleAssignRole() {
    if (!selectedAccountId) {
      return;
    }

    await runAdminAction(async () => {
      await assignRole(selectedAccountId, editForm.role);
      await loadAccounts();
    }, "Poste affecté");
  }

  async function handleDisableAccount() {
    if (!selectedAccountId) {
      return;
    }

    await runAdminAction(async () => {
      await disableAccount(selectedAccountId);
      await loadAccounts();
    }, "Compte suspendu");
  }

  async function handleResetPassword() {
    if (!selectedAccountId) {
      return;
    }

    await runAdminAction(async () => {
      const result = await resetAccountPassword(selectedAccountId);
      setGeneratedPassword(result.generatedPassword);
      await loadAccounts();
    }, "Mot de passe régénéré");
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAdminAction(async () => {
      const service = await createService({ name: createServiceForm.name });
      setCreateServiceForm(emptyServiceForm());
      await loadCatalog();
      onCatalogChanged();
      navigate(`/admin/services/${service.id}`);
    }, "Service créé");
  }

  async function handleUpdateService(
    event: FormEvent<HTMLFormElement>,
    service: Service,
    form: ServiceFormState,
  ) {
    event.preventDefault();
    await runAdminAction(async () => {
      await updateService(service.id, { name: form.name });
      await Promise.all([loadCatalog(), loadAccounts(), loadPatients()]);
      onCatalogChanged();
    }, "Service mis à jour");
  }

  async function handleDeleteService(service: Service) {
    const confirmed = window.confirm(`Supprimer le service ${service.name} ?`);

    if (!confirmed) {
      return;
    }

    await runAdminAction(async () => {
      await deleteService(service.id);
      await loadCatalog();
      onCatalogChanged();
      navigate("/admin/services");
    }, "Service supprimé");
  }

  function handleCreateRoomDraft(serviceName: string) {
    if (!serviceName) {
      return;
    }

    const serviceRooms = [
      ...rooms.filter((room) => room.service === serviceName),
      ...draftRooms.filter((room) => room.service === serviceName),
    ];
    const draftRoom: EditableRoomCardModel = {
      id: createLocalId("room"),
      label: nextRoomDraftLabel(serviceRooms),
      service: serviceName,
      sortOrder: nextRoomSortOrder(serviceRooms),
      isDraft: true,
      beds: [],
    };

    setDraftRooms((current) => [...current, draftRoom]);
    setFocusedRoomId(draftRoom.id);
  }

  function handleRoomCardDraftChange(roomDraft: EditableRoomCardModel) {
    if (roomDraft.isDraft) {
      setDraftRooms((current) =>
        current.map((room) =>
          room.id === roomDraft.id ? { ...roomDraft, hasChanges: true } : room,
        ),
      );
      return;
    }

    setRoomDraftOverrides((current) => ({
      ...current,
      [roomDraft.id]: { ...roomDraft, hasChanges: true },
    }));
  }

  async function handleSaveRoomCard(roomDraft: EditableRoomCardModel) {
    const label = roomDraft.label.trim();

    if (!label) {
      setError("Renseignez un nom de chambre");
      return;
    }

    const desiredBeds = normalizeEditableBeds(roomDraft.beds);
    const previousRooms = rooms;
    const previousBeds = beds;
    const previousDraftRooms = draftRooms;
    const previousRoomDraftOverrides = roomDraftOverrides;
    const previousFocusedRoomId = focusedRoomId;

    if (!roomDraft.persistedId) {
      const optimisticRoom = editableRoomToRoom({
        ...roomDraft,
        label,
      });
      const optimisticBeds = editableBedsToBeds(
        desiredBeds,
        optimisticRoom.id,
        optimisticRoom.label,
        optimisticRoom.service,
      );

      setRooms((current) => [...current, optimisticRoom]);
      setBeds((current) => [...current, ...optimisticBeds]);
      setDraftRooms((current) =>
        current.filter((room) => room.id !== roomDraft.id),
      );
      setRoomDraftOverrides((current) => omitRecordKey(current, roomDraft.id));
      setFocusedRoomId(null);

      await runAdminAction(async () => {
        try {
          const room = await createRoom({
            label,
            service: roomDraft.service,
            sortOrder: positiveSortOrder(roomDraft.sortOrder),
          });
          const createdBeds = await Promise.all(
            desiredBeds.map((bed) =>
              createBed({
                label: bed.label,
                roomId: room.id,
                sortOrder: bed.sortOrder,
              }),
            ),
          );

          setRooms((current) =>
            current.map((currentRoom) =>
              currentRoom.id === optimisticRoom.id ? room : currentRoom,
            ),
          );
          setBeds((current) => [
            ...current.filter((bed) => bed.roomId !== optimisticRoom.id),
            ...createdBeds,
          ]);
          onCatalogChanged();
        } catch (saveError) {
          setRooms(previousRooms);
          setBeds(previousBeds);
          setDraftRooms(previousDraftRooms);
          setRoomDraftOverrides(previousRoomDraftOverrides);
          setFocusedRoomId(previousFocusedRoomId);
          throw saveError;
        }
      }, "Chambre créée");
      return;
    }

    const persistedRoomId = roomDraft.persistedId;
    const existingRoomBeds = beds.filter(
      (bed) => bed.roomId === persistedRoomId,
    );
    const desiredPersistedBedIds = new Set(
      desiredBeds
        .map((bed) => bed.persistedId)
        .filter((bedId): bedId is string => Boolean(bedId)),
    );
    const removedBeds = existingRoomBeds.filter(
      (bed) => !desiredPersistedBedIds.has(bed.id),
    );
    const occupiedRemovedBed = removedBeds.find((bed) => bed.occupiedPatientId);

    if (occupiedRemovedBed) {
      setError(
        `Impossible de supprimer le lit ${occupiedRemovedBed.label}: un patient y est assigné`,
      );
      return;
    }

    const optimisticRoom = editableRoomToRoom({
      ...roomDraft,
      label,
    });
    const optimisticBeds = editableBedsToBeds(
      desiredBeds,
      persistedRoomId,
      label,
      roomDraft.service,
    );

    setRooms((current) =>
      current.map((room) =>
        room.id === persistedRoomId ? optimisticRoom : room,
      ),
    );
    setBeds((current) => [
      ...current.filter((bed) => bed.roomId !== persistedRoomId),
      ...optimisticBeds,
    ]);
    setRoomDraftOverrides((current) => omitRecordKey(current, roomDraft.id));

    await runAdminAction(async () => {
      try {
        const savedRoom = await updateRoom(persistedRoomId, {
          label,
          service: roomDraft.service,
          sortOrder: positiveSortOrder(roomDraft.sortOrder),
        });

        const savedBeds = await Promise.all(
          desiredBeds.map((bed) =>
            bed.persistedId
              ? updateBed(bed.persistedId, {
                  label: bed.label,
                  roomId: persistedRoomId,
                  sortOrder: bed.sortOrder,
                })
              : createBed({
                  label: bed.label,
                  roomId: persistedRoomId,
                  sortOrder: bed.sortOrder,
                }),
          ),
        );

        for (const bed of removedBeds.reverse()) {
          await deleteBed(bed.id);
        }

        setRooms((current) =>
          current.map((room) =>
            room.id === persistedRoomId ? savedRoom : room,
          ),
        );
        setBeds((current) => [
          ...current.filter((bed) => bed.roomId !== persistedRoomId),
          ...savedBeds,
        ]);
        onCatalogChanged();
      } catch (saveError) {
        setRooms(previousRooms);
        setBeds(previousBeds);
        setDraftRooms(previousDraftRooms);
        setRoomDraftOverrides(previousRoomDraftOverrides);
        setFocusedRoomId(previousFocusedRoomId);
        throw saveError;
      }
    }, "Chambre mise à jour");
  }

  async function handleDeleteRoomCard(roomDraft: EditableRoomCardModel) {
    const roomBeds = roomDraft.persistedId
      ? beds.filter((bed) => bed.roomId === roomDraft.persistedId)
      : roomDraft.beds;
    const occupiedBed = roomBeds.find((bed) => bed.occupiedPatientId);

    if (occupiedBed) {
      setError(
        `Impossible de supprimer la chambre: le lit ${occupiedBed.label} est occupé`,
      );
      return;
    }

    setRoomPendingDeletion(roomDraft);
  }

  async function confirmDeleteRoomCard() {
    if (!roomPendingDeletion) {
      return;
    }

    const roomDraft = roomPendingDeletion;

    if (!roomDraft.persistedId) {
      setDraftRooms((current) =>
        current.filter((room) => room.id !== roomDraft.id),
      );
      setRoomDraftOverrides((current) => omitRecordKey(current, roomDraft.id));
      setFocusedRoomId(null);
      setRoomPendingDeletion(null);
      return;
    }

    const persistedRoomId = roomDraft.persistedId;
    const roomBeds = beds.filter((bed) => bed.roomId === persistedRoomId);
    const previousRooms = rooms;
    const previousBeds = beds;
    const previousRoomDraftOverrides = roomDraftOverrides;

    setRooms((current) =>
      current.filter((room) => room.id !== persistedRoomId),
    );
    setBeds((current) =>
      current.filter((bed) => bed.roomId !== persistedRoomId),
    );
    setRoomDraftOverrides((current) => omitRecordKey(current, roomDraft.id));
    setRoomPendingDeletion(null);

    await runAdminAction(async () => {
      try {
        for (const bed of roomBeds.reverse()) {
          await deleteBed(bed.id);
        }

        await deleteRoom(persistedRoomId);
        onCatalogChanged();
      } catch (deleteError) {
        setRooms(previousRooms);
        setBeds(previousBeds);
        setRoomDraftOverrides(previousRoomDraftOverrides);
        throw deleteError;
      }
    }, "Chambre supprimée");
  }

  if (view.type === "unknown") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-5 min-h-full">
      <AdminHeader view={view} />

      {error && <AlertMessage message={error} />}
      {success && <AlertMessage tone="success" message={success} />}
      {generatedPassword && (
        <AlertMessage
          tone="success"
          message={`Mot de passe généré: ${generatedPassword}`}
        />
      )}
      <Dialog
        open={roomPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoomPendingDeletion(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la chambre</DialogTitle>
            <DialogDescription>
              {roomPendingDeletion
                ? `La chambre ${roomPendingDeletion.label} sera supprimée. Cette action est définitive.`
                : "Cette chambre sera supprimée."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoomPendingDeletion(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteRoomCard()}
            >
              <Trash2 className="size-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {view.type === "home" && (
        <AdminHome
          accounts={accounts}
          patients={patients}
          rooms={rooms}
          services={services}
          onOpen={(path) => navigate(path)}
        />
      )}

      {view.type === "personnel" && (
        <PersonnelPage
          accounts={accounts}
          createAccountForm={createAccountForm}
          createForm={createForm}
          editAccountForm={editAccountForm}
          editForm={editForm}
          filteredAccounts={filteredAccounts}
          loading={loading}
          personnelRole={personnelRole}
          personnelSearch={personnelSearch}
          personnelService={personnelService}
          selectedAccount={selectedAccount}
          selectedAccountId={selectedAccountId}
          services={services}
          onAssignRole={() => void handleAssignRole()}
          onCreateAccount={handleCreateAccount}
          onDisableAccount={() => void handleDisableAccount()}
          onResetPassword={() => void handleResetPassword()}
          onSelectAccount={setSelectedAccountId}
          onSetCreateForm={setCreateForm}
          onSetEditForm={setEditForm}
          onSetPersonnelRole={setPersonnelRole}
          onSetPersonnelSearch={setPersonnelSearch}
          onSetPersonnelService={setPersonnelService}
          onUpdateAccount={handleUpdateAccount}
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
          onOpenService={(serviceId) =>
            navigate(`/admin/services/${serviceId}`)
          }
          onSetCreateServiceForm={setCreateServiceForm}
        />
      )}

      {view.type === "service-detail" && (
        <ServiceDetailPage
          accounts={accounts}
          beds={beds}
          createAccountForm={createAccountForm}
          createForm={createForm}
          patients={patients}
          draftRooms={draftRooms}
          focusedRoomId={focusedRoomId}
          roomDraftOverrides={roomDraftOverrides}
          rooms={rooms}
          service={activeService}
          onBack={() => navigate("/admin/services")}
          onCreateAccount={handleCreateAccount}
          onCreateRoom={(serviceName) => handleCreateRoomDraft(serviceName)}
          onDeleteService={(service) => void handleDeleteService(service)}
          onDeleteRoom={(room) => void handleDeleteRoomCard(room)}
          onDraftChange={handleRoomCardDraftChange}
          onRoomFocusHandled={() => setFocusedRoomId(null)}
          onSaveRoom={(room) => void handleSaveRoomCard(room)}
          onSetCreateForm={setCreateForm}
          onUpdateService={(event, service, form) =>
            void handleUpdateService(event, service, form)
          }
        />
      )}
    </div>
  );
}

function AdminHeader({ view }: { view: AdminView }) {
  const navigate = useNavigate();
  const title =
    view.type === "personnel"
      ? "Personnel"
      : view.type === "services" || view.type === "service-detail"
        ? "Services"
        : "Administration";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {view.type !== "home" && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate("/admin")}
            aria-label="Retour à l'administration"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-medium">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestion opérationnelle de l'hôpital
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminHome({
  accounts,
  patients,
  rooms,
  services,
  onOpen,
}: {
  accounts: Account[];
  patients: Patient[];
  rooms: Room[];
  services: Service[];
  onOpen: (path: string) => void;
}) {
  const activePatients = patients.filter(
    (patient) => patient.currentVisitId,
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
  );
}

function AdminLandingCard({
  detail,
  icon: Icon,
  onClick,
  stats,
  title,
}: {
  detail: string;
  icon: typeof Users;
  onClick: () => void;
  stats: string[];
  title: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-lg font-medium">
            {title}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {detail}
          </span>
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
  );
}

function PersonnelPage({
  createAccountForm,
  createForm,
  editAccountForm,
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
  accounts: Account[];
  createAccountForm: UseFormReturn<AccountFormState>;
  createForm: AccountFormState;
  editAccountForm: UseFormReturn<AccountFormState>;
  editForm: AccountFormState;
  filteredAccounts: Account[];
  loading: boolean;
  personnelRole: string;
  personnelSearch: string;
  personnelService: string;
  selectedAccount: Account | undefined;
  selectedAccountId: number | null;
  services: Service[];
  onAssignRole: () => void;
  onCreateAccount: () => Promise<boolean>;
  onDisableAccount: () => void;
  onResetPassword: () => void;
  onSelectAccount: (accountId: number) => void;
  onSetCreateForm: (form: AccountFormState) => void;
  onSetEditForm: (form: AccountFormState) => void;
  onSetPersonnelRole: (role: string) => void;
  onSetPersonnelSearch: (search: string) => void;
  onSetPersonnelService: (service: string) => void;
  onUpdateAccount: () => Promise<void>;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="rounded-lg border bg-background p-4">
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
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className={cn(
                      "cursor-pointer",
                      selectedAccountId === account.id && "bg-primary/5",
                    )}
                    onClick={() => onSelectAccount(account.id)}
                  >
                    <TableCell className="font-medium">
                      {account.name}
                    </TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>{ROLE_LABELS[account.role]}</TableCell>
                    <TableCell>{account.service}</TableCell>
                    <TableCell>
                      <AccountStatusBadge status={account.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmptyRow colSpan={5}>
                  {loading ? "Chargement du personnel" : "Aucun membre trouvé"}
                </TableEmptyRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-4">
        <form
          className="grid gap-3 rounded-lg border bg-background p-4"
          noValidate
          onSubmit={createAccountForm.handleSubmit(onCreateAccount)}
        >
          <SectionTitle icon={UserPlus} title="Nouveau membre" />
          <AccountFields
            control={createAccountForm.control}
            errors={createAccountForm.formState.errors}
            form={createForm}
            register={createAccountForm.register}
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
          className="grid gap-3 rounded-lg border bg-background p-4"
          noValidate
          onSubmit={editAccountForm.handleSubmit(onUpdateAccount)}
        >
          <SectionTitle icon={UserCog} title="Membre sélectionné" />
          {selectedAccount ? (
            <>
              <AccountFields
                control={editAccountForm.control}
                errors={editAccountForm.formState.errors}
                form={editForm}
                register={editAccountForm.register}
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
  );
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
  accounts: Account[];
  beds: Bed[];
  createServiceForm: ServiceFormState;
  patients: Patient[];
  rooms: Room[];
  services: Service[];
  onCreateService: (event: FormEvent<HTMLFormElement>) => void;
  onOpenService: (serviceId: string) => void;
  onSetCreateServiceForm: (form: ServiceFormState) => void;
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
        className="grid content-start gap-3 rounded-lg border bg-background p-4"
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
  );
}

function ServiceDetailPage({
  accounts,
  beds,
  createAccountForm,
  createForm,
  patients,
  draftRooms,
  focusedRoomId,
  roomDraftOverrides,
  rooms,
  service,
  onBack,
  onCreateAccount,
  onCreateRoom,
  onDeleteRoom,
  onDeleteService,
  onDraftChange,
  onRoomFocusHandled,
  onSaveRoom,
  onSetCreateForm,
  onUpdateService,
}: {
  accounts: Account[];
  beds: Bed[];
  createAccountForm: UseFormReturn<AccountFormState>;
  createForm: AccountFormState;
  patients: Patient[];
  draftRooms: EditableRoomCardModel[];
  focusedRoomId: string | null;
  roomDraftOverrides: Record<string, EditableRoomCardModel>;
  rooms: Room[];
  service: Service | null | undefined;
  onBack: () => void;
  onCreateAccount: () => Promise<boolean>;
  onCreateRoom: (serviceName: string) => void;
  onDeleteRoom: (room: EditableRoomCardModel) => void;
  onDeleteService: (service: Service) => void;
  onDraftChange: (room: EditableRoomCardModel) => void;
  onRoomFocusHandled: () => void;
  onSaveRoom: (room: EditableRoomCardModel) => void;
  onSetCreateForm: (form: AccountFormState) => void;
  onUpdateService: (
    event: FormEvent<HTMLFormElement>,
    service: Service,
    form: ServiceFormState,
  ) => void;
}) {
  if (!service) {
    return <EmptyState label="Service introuvable" />;
  }

  return (
    <ServiceDetailContent
      key={`${service.id}:${service.name}`}
      accounts={accounts}
      beds={beds}
      createAccountForm={createAccountForm}
      createForm={createForm}
      patients={patients}
      draftRooms={draftRooms}
      focusedRoomId={focusedRoomId}
      roomDraftOverrides={roomDraftOverrides}
      rooms={rooms}
      service={service}
      onBack={onBack}
      onCreateAccount={onCreateAccount}
      onCreateRoom={onCreateRoom}
      onDeleteRoom={onDeleteRoom}
      onDeleteService={onDeleteService}
      onDraftChange={onDraftChange}
      onRoomFocusHandled={onRoomFocusHandled}
      onSaveRoom={onSaveRoom}
      onSetCreateForm={onSetCreateForm}
      onUpdateService={onUpdateService}
    />
  );
}

function ServiceDetailContent({
  accounts,
  beds,
  createAccountForm,
  createForm,
  patients,
  draftRooms,
  focusedRoomId,
  roomDraftOverrides,
  rooms,
  service,
  onBack,
  onCreateAccount,
  onCreateRoom,
  onDeleteRoom,
  onDeleteService,
  onDraftChange,
  onRoomFocusHandled,
  onSaveRoom,
  onSetCreateForm,
  onUpdateService,
}: {
  accounts: Account[];
  beds: Bed[];
  createAccountForm: UseFormReturn<AccountFormState>;
  createForm: AccountFormState;
  patients: Patient[];
  draftRooms: EditableRoomCardModel[];
  focusedRoomId: string | null;
  roomDraftOverrides: Record<string, EditableRoomCardModel>;
  rooms: Room[];
  service: Service;
  onBack: () => void;
  onCreateAccount: () => Promise<boolean>;
  onCreateRoom: (serviceName: string) => void;
  onDeleteRoom: (room: EditableRoomCardModel) => void;
  onDeleteService: (service: Service) => void;
  onDraftChange: (room: EditableRoomCardModel) => void;
  onRoomFocusHandled: () => void;
  onSaveRoom: (room: EditableRoomCardModel) => void;
  onSetCreateForm: (form: AccountFormState) => void;
  onUpdateService: (
    event: FormEvent<HTMLFormElement>,
    service: Service,
    form: ServiceFormState,
  ) => void;
}) {
  const [form, setForm] = useState<ServiceFormState>(() =>
    serviceToForm(service),
  );
  const [addingPersonnel, setAddingPersonnel] = useState(false);
  const serviceRooms = rooms.filter((room) => room.service === service.name);
  const serviceDraftRooms = draftRooms.filter(
    (room) => room.service === service.name,
  );
  const serviceBeds = beds.filter((bed) => bed.service === service.name);
  const occupiedBeds = occupiedBedCount(serviceBeds);
  const serviceAccounts = accounts.filter(
    (account) => account.service === service.name,
  );
  const openAddPersonnelDialog = () => {
    createAccountForm.clearErrors();
    onSetCreateForm(emptyAccountForm(service.name));
    setAddingPersonnel(true);
  };
  const submitServiceAccount = createAccountForm.handleSubmit(() =>
    onCreateAccount().then((created) => {
      if (created) {
        setAddingPersonnel(false);
      }
    }),
  );

  return (
    <div className="space-y-4">
      <form
        className="grid gap-4 rounded-lg border bg-background p-4"
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
        canCreateRoom
        draftRooms={serviceDraftRooms}
        focusedRoomId={focusedRoomId}
        rooms={serviceRooms}
        roomDraftOverrides={roomDraftOverrides}
        onCreateRoom={() => onCreateRoom(service.name)}
        onDeleteRoom={onDeleteRoom}
        onDraftChange={onDraftChange}
        onRoomFocusHandled={onRoomFocusHandled}
        onSaveRoom={onSaveRoom}
      />

      <div className="rounded-lg border bg-background p-4">
        <SectionTitle
          icon={Users}
          title="Personnel du service"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={openAddPersonnelDialog}
            >
              <UserPlus className="size-4" />
              Ajouter
            </Button>
          }
        />
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
              {serviceAccounts.length > 0 ? (
                serviceAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.name}
                    </TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>{ROLE_LABELS[account.role]}</TableCell>
                    <TableCell>
                      <AccountStatusBadge status={account.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmptyRow colSpan={4}>
                  Aucun personnel dans ce service
                </TableEmptyRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={addingPersonnel} onOpenChange={setAddingPersonnel}>
        <DialogContent>
          <form
            className="grid gap-4"
            noValidate
            onSubmit={submitServiceAccount}
          >
            <DialogHeader>
              <DialogTitle>Ajouter du personnel</DialogTitle>
              <DialogDescription>
                Le nouveau membre sera rattaché au service {service.name}.
              </DialogDescription>
            </DialogHeader>
            <AccountFields
              control={createAccountForm.control}
              errors={createAccountForm.formState.errors}
              form={createForm}
              register={createAccountForm.register}
              services={[service]}
              onChange={onSetCreateForm}
              invite
              serviceLocked
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddingPersonnel(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                <UserPlus className="size-4" />
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceCard({
  accounts,
  beds,
  patients,
  rooms,
  service,
  onClick,
}: {
  accounts: Account[];
  beds: Bed[];
  patients: Patient[];
  rooms: Room[];
  service: Service;
  onClick: () => void;
}) {
  const serviceBeds = beds.filter((bed) => bed.service === service.name);
  const occupiedBeds = occupiedBedCount(serviceBeds);

  return (
    <button
      type="button"
      className="grid min-h-52 gap-4 rounded-lg border bg-background p-5 text-left transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-heading text-xl font-medium">
            {service.name}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {rooms.filter((room) => room.service === service.name).length}{" "}
            chambres ·{" "}
            {
              accounts.filter((account) => account.service === service.name)
                .length
            }{" "}
            membres
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
  );
}

function AdminRoomGrid({
  beds,
  canCreateRoom = false,
  draftRooms = [],
  focusedRoomId = null,
  roomDraftOverrides = {},
  rooms,
  onCreateRoom,
  onDeleteRoom,
  onDraftChange,
  onRoomFocusHandled,
  onSaveRoom,
}: {
  beds: Bed[];
  canCreateRoom?: boolean;
  draftRooms?: EditableRoomCardModel[];
  focusedRoomId?: string | null;
  roomDraftOverrides?: Record<string, EditableRoomCardModel>;
  rooms: Room[];
  onCreateRoom?: () => void;
  onDeleteRoom: (room: EditableRoomCardModel) => void;
  onDraftChange: (room: EditableRoomCardModel) => void;
  onRoomFocusHandled?: () => void;
  onSaveRoom: (room: EditableRoomCardModel) => void;
}) {
  const groupedRooms = useMemo(
    () => groupRoomsWithBeds(rooms, beds),
    [beds, rooms],
  );
  const persistedCards = useMemo(
    () => groupedRooms.map(roomWithBedsToEditableCard),
    [groupedRooms],
  );
  const mergedPersistedCards = useMemo(
    () => persistedCards.map((room) => roomDraftOverrides[room.id] ?? room),
    [persistedCards, roomDraftOverrides],
  );
  const gridItems = useMemo<Array<EditableRoomCardModel | null>>(
    () =>
      onCreateRoom
        ? [...mergedPersistedCards, ...draftRooms, null]
        : mergedPersistedCards,
    [draftRooms, mergedPersistedCards, onCreateRoom],
  );
  const mobileColumns = useMemo(
    () => distributeGridItems(gridItems, 1),
    [gridItems],
  );
  const tabletColumns = useMemo(
    () => distributeGridItems(gridItems, 2),
    [gridItems],
  );
  const desktopColumns = useMemo(
    () => distributeGridItems(gridItems, 3),
    [gridItems],
  );
  const occupiedCount = beds.filter((bed) => bed.occupiedPatientId).length;
  const renderColumn = (
    items: Array<EditableRoomCardModel | null>,
    columnIndex: number,
  ) => (
    <LayoutGroup key={columnIndex}>
      <div className="flex min-w-0 flex-col gap-4">
        {items.map((item, itemIndex) =>
          item ? (
            <AdminRoomCard
              key={roomCardKey(item)}
              autoFocusName={item.id === focusedRoomId}
              room={item}
              onDeleteRoom={onDeleteRoom}
              onDraftChange={onDraftChange}
              onRoomFocusHandled={onRoomFocusHandled}
              onSaveRoom={onSaveRoom}
            />
          ) : (
            <NewRoomPlaceholder
              key={`new-room-${columnIndex}-${itemIndex}`}
              disabled={!canCreateRoom}
              onCreateRoom={onCreateRoom}
            />
          ),
        )}
      </div>
    </LayoutGroup>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-medium">
          <BedIcon className="size-4 text-muted-foreground" />
          Chambres
        </h2>
        <p className="text-xs text-muted-foreground">
          {occupiedCount} / {beds.length} lit{beds.length > 1 ? "s" : ""} occupé
          {occupiedCount > 1 ? "s" : ""}
        </p>
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
  );
}

function AdminRoomCard({
  autoFocusName,
  room,
  onDeleteRoom,
  onDraftChange,
  onRoomFocusHandled,
  onSaveRoom,
}: {
  autoFocusName: boolean;
  room: EditableRoomCardModel;
  onDeleteRoom: (room: EditableRoomCardModel) => void;
  onDraftChange: (room: EditableRoomCardModel) => void;
  onRoomFocusHandled?: () => void;
  onSaveRoom: (room: EditableRoomCardModel) => void;
}) {
  const roomInputRef = useRef<HTMLInputElement>(null);
  const occupiedCount = room.beds.filter((bed) => bed.occupiedPatientId).length;
  const dirty = room.isDraft || Boolean(room.hasChanges);

  useEffect(() => {
    if (!autoFocusName) {
      return;
    }

    roomInputRef.current?.focus();
    roomInputRef.current?.select();
    onRoomFocusHandled?.();
  }, [autoFocusName, onRoomFocusHandled]);

  function addBedDraft() {
    onDraftChange({
      ...room,
      hasChanges: true,
      beds: [
        ...room.beds,
        {
          id: createLocalId("bed"),
          label: nextBedDraftLabel(room.beds),
          sortOrder: nextBedSortOrder(room.beds),
        },
      ],
    });
  }

  function updateBedDraft(bedId: string, label: string) {
    onDraftChange({
      ...room,
      hasChanges: true,
      beds: room.beds.map((bed) =>
        bed.id === bedId ? { ...bed, label } : bed,
      ),
    });
  }

  function deleteBedDraft(bedId: string) {
    onDraftChange({
      ...room,
      hasChanges: true,
      beds: room.beds.filter((bed) => bed.id !== bedId),
    });
  }

  function reorderBedDrafts(beds: EditableBedModel[]) {
    onDraftChange({
      ...room,
      hasChanges: true,
      beds,
    });
  }

  function updateRoomLabel(label: string) {
    onDraftChange({
      ...room,
      hasChanges: true,
      label,
    });
  }

  function resetEmptyRoomLabel() {
    if (room.label.trim()) {
      return;
    }

    onDraftChange({
      ...room,
      hasChanges: true,
      label: "Nouvelle chambre",
    });
  }

  function saveCard() {
    const trimmedLabel = room.label.trim();

    if (!trimmedLabel) {
      updateRoomLabel("Nouvelle chambre");
      return;
    }

    onSaveRoom({
      ...room,
      label: trimmedLabel,
      beds: room.beds,
    });
  }

  return (
    <motion.div
      layout
      layoutId={`room-card-${room.id}`}
      className="flex flex-col rounded-lg border bg-background p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <form
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            roomInputRef.current?.blur();
          }}
        >
          <Input
            ref={roomInputRef}
            className="-ml-2.5 h-8 cursor-text border-transparent font-heading text-lg font-medium shadow-none"
            value={room.label}
            onBlur={resetEmptyRoomLabel}
            onChange={(event) => updateRoomLabel(event.target.value)}
            aria-label={`Nom de la chambre ${room.label}`}
          />
          <p className="text-xs text-muted-foreground">
            {room.service} · {room.beds.length} lit
            {room.beds.length > 1 ? "s" : ""}
          </p>
        </form>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">
            {occupiedCount}/{room.beds.length}
          </Badge>
          <Button
            type="button"
            variant="destructive"
            size="icon-lg"
            onClick={() => onDeleteRoom(room)}
            aria-label={`Supprimer la chambre ${room.label}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
        {room.beds.length > 0 ? (
          <Reorder.Group
            axis="y"
            className="grid gap-2"
            values={room.beds}
            onReorder={reorderBedDrafts}
          >
            {room.beds.map((bed) => (
              <EditableBedRow
                key={bed.id}
                bed={bed}
                onChange={(value) => updateBedDraft(bed.id, value)}
                onDelete={() => deleteBedDraft(bed.id)}
              />
            ))}
          </Reorder.Group>
        ) : null}
        <AddBedPlaceholder onAddBed={addBedDraft} />
      </div>

      {dirty && (
        <Button type="button" className="mt-4" onClick={saveCard}>
          <Save className="size-4" />
          Enregistrer
        </Button>
      )}
    </motion.div>
  );
}

function EditableBedRow({
  bed,
  onChange,
  onDelete,
}: {
  bed: EditableBedModel;
  onChange: (value: string) => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();
  const occupied = Boolean(bed.occupiedPatientId);
  const occupiedStyle =
    bed.occupiedPatientSex === "female"
      ? "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-400/40 dark:bg-pink-950/30 dark:text-pink-200"
      : bed.occupiedPatientSex === "male"
        ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-950/30 dark:text-blue-200"
        : "border-primary/30 bg-primary/10 text-primary";

  return (
    <Reorder.Item
      value={bed}
      dragControls={dragControls}
      dragListener={false}
      layout
      className={cn(
        "group relative flex min-h-16 min-w-0 items-center gap-2 rounded-xl border px-2 py-2 text-left text-sm",
        occupied
          ? occupiedStyle
          : "border-dashed border-input bg-transparent text-muted-foreground",
      )}
    >
      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onPointerDown={(event) => dragControls.start(event)}
        aria-label={`Déplacer le lit ${bed.label}`}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <Input
          className="-ml-2.5 h-8 cursor-text border-transparent bg-transparent text-sm font-medium shadow-none"
          value={bed.label}
          onBlur={() => {
            if (!bed.label.trim()) {
              onChange("Nouveau lit");
            }
          }}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          aria-label={`Nom du lit ${bed.label}`}
        />
        {occupied && (
          <p className="truncate text-xs font-medium">
            {bed.occupiedPatientName ?? "Patient assigné"}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs font-medium">
        {occupied ? "Occupé" : "Libre"}
      </span>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          disabled={occupied}
          onClick={onDelete}
          aria-label={`Supprimer le lit ${bed.label}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

function AddBedPlaceholder({ onAddBed }: { onAddBed: () => void }) {
  return (
    <button
      type="button"
      className="flex h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-transparent text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onAddBed}
    >
      <Plus className="size-4" />
      Nouveau lit
    </button>
  );
}

function NewRoomPlaceholder({
  disabled,
  onCreateRoom,
}: {
  disabled: boolean;
  onCreateRoom?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-background/60 p-4 text-center text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-background/60 disabled:hover:text-muted-foreground"
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
  );
}

function AccountFields({
  control,
  errors,
  form,
  register,
  services,
  onChange,
  invite = false,
  serviceLocked = false,
}: {
  control: Control<AccountFormState>;
  errors: FieldErrors<AccountFormState>;
  form: AccountFormState;
  register: UseFormRegister<AccountFormState>;
  services: Service[];
  onChange: (form: AccountFormState) => void;
  invite?: boolean;
  serviceLocked?: boolean;
}) {
  const nameRegistration = register("name", {
    validate: validateRequired,
    onChange: (event) => onChange({ ...form, name: event.target.value }),
  });
  const emailRegistration = register("email", {
    validate: validateRequiredEmail,
    onChange: (event) => onChange({ ...form, email: event.target.value }),
  });

  return (
    <>
      <Field label="Nom" required error={errors.name?.message}>
        <Input
          {...nameRegistration}
          aria-invalid={!!errors.name}
          value={form.name}
        />
      </Field>
      <Field label="Courriel" required error={errors.email?.message}>
        <Input
          {...emailRegistration}
          type="text"
          inputMode="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          value={form.email}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Poste" required error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            rules={{ validate: validateRequired }}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(role) => {
                  field.onChange(role);
                  onChange({ ...form, role: role as UserRole });
                }}
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
            )}
          />
        </Field>
        <Field label="Service" required error={errors.service?.message}>
          <Controller
            control={control}
            name="service"
            rules={{ validate: validateRequired }}
            render={({ field }) => (
              <ServiceSelect
                services={services}
                disabled={serviceLocked}
                value={field.value ?? ""}
                onChange={(service) => {
                  field.onChange(service);
                  onChange({ ...form, service });
                }}
              />
            )}
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
  );
}

function AccountStatusBadge({ status }: { status: Account["status"] }) {
  const variant =
    status === "disabled"
      ? "destructive"
      : status === "invited"
        ? "outline"
        : "secondary";

  return <Badge variant={variant}>{ACCOUNT_STATUS_LABELS[status]}</Badge>;
}

function StatBox({
  label,
  occupancyRatio,
  value,
}: {
  label: string;
  occupancyRatio?: number;
  value: number | string;
}) {
  return (
    <span
      className={cn(
        "rounded-lg border bg-muted/30 p-3 transition-colors",
        occupancyRatio != null && occupancyToneClass(occupancyRatio),
      )}
    >
      <span className="block font-mono text-3xl font-semibold tracking-normal">
        {value}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

function occupancyRatio(occupied: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return occupied / total;
}

function occupancyToneClass(ratio: number) {
  if (ratio >= 0.9) {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100";
  }

  if (ratio >= 0.75) {
    return "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-400/40 dark:bg-orange-950/30 dark:text-orange-100";
  }

  if (ratio >= 0.5) {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-100";
}

function parseAdminView(pathname: string): AdminView {
  const parts = pathname
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length === 0) {
    return { type: "home" };
  }

  if (parts[0] === "personnel" && parts.length === 1) {
    return { type: "personnel" };
  }

  if (parts[0] === "services" && parts.length === 1) {
    return { type: "services" };
  }

  if (parts[0] === "services" && parts[1] && parts.length === 2) {
    return { type: "service-detail", serviceId: parts[1] };
  }

  return { type: "unknown" };
}

function groupRoomsWithBeds(rooms: Room[], beds: Bed[]): RoomWithBeds[] {
  return [...rooms]
    .sort((left, right) => {
      const leftDraft = isDraftRoom(left);
      const rightDraft = isDraftRoom(right);

      if (leftDraft !== rightDraft) {
        return leftDraft ? 1 : -1;
      }

      return (
        left.service.localeCompare(right.service) ||
        left.sortOrder - right.sortOrder ||
        left.label.localeCompare(right.label)
      );
    })
    .map((room) => ({
      ...room,
      beds: beds.filter((bed) => bed.roomId === room.id).sort(compareBeds),
    }));
}

function roomWithBedsToEditableCard(room: RoomWithBeds): EditableRoomCardModel {
  return {
    id: room.id,
    persistedId: room.id,
    label: room.label,
    service: room.service,
    sortOrder: room.sortOrder,
    isDraft: false,
    beds: room.beds.map((bed) => ({
      id: bed.id,
      persistedId: bed.id,
      label: bed.label,
      sortOrder: bed.sortOrder,
      occupiedPatientId: bed.occupiedPatientId,
      occupiedPatientName: bed.occupiedPatientName,
      occupiedPatientSex: bed.occupiedPatientSex,
    })),
  };
}

function editableRoomToRoom(room: EditableRoomCardModel): Room {
  return {
    id: room.persistedId ?? room.id,
    label: room.label,
    service: room.service,
    sortOrder: room.sortOrder,
  };
}

function editableBedsToBeds(
  beds: EditableBedModel[],
  roomId: string,
  roomLabel: string,
  service: string,
): Bed[] {
  return beds.map((bed) => ({
    id: bed.persistedId ?? bed.id,
    label: bed.label,
    roomId,
    room: roomLabel,
    service,
    sortOrder: bed.sortOrder,
    occupiedPatientId: bed.occupiedPatientId,
    occupiedPatientName: bed.occupiedPatientName,
    occupiedPatientSex: bed.occupiedPatientSex,
  }));
}

function roomCardKey(room: EditableRoomCardModel) {
  return room.id;
}

function normalizeEditableBeds(beds: EditableBedModel[]): EditableBedModel[] {
  return beds.map((bed, index) => {
    const label = bed.label.trim();

    return {
      ...bed,
      label: label || `${index + 1}`,
      sortOrder: index + 1,
    };
  });
}

function omitRecordKey<T>(record: Record<string, T>, key: string) {
  const nextRecord = { ...record };
  delete nextRecord[key];

  return nextRecord;
}

function distributeGridItems<T>(items: T[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as T[]);

  items.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });

  return columns;
}

function nextRoomDraftLabel(rooms: Array<Pick<Room, "label">>) {
  const baseLabel = "Nouvelle chambre";
  const existingLabels = new Set(
    rooms.map((room) => room.label.trim().toLocaleLowerCase()),
  );

  if (!existingLabels.has(baseLabel.toLocaleLowerCase())) {
    return baseLabel;
  }

  let index = 2;

  while (existingLabels.has(`${baseLabel} ${index}`.toLocaleLowerCase())) {
    index += 1;
  }

  return `${baseLabel} ${index}`;
}

function isDraftRoom(room: Pick<Room, "label">) {
  return /^Nouvelle chambre(?: \d+)?$/.test(room.label.trim());
}

function nextRoomSortOrder(rooms: Array<Pick<Room, "sortOrder">>) {
  const highestSortOrder = Math.max(0, ...rooms.map((room) => room.sortOrder));

  return highestSortOrder + 1;
}

function nextBedDraftLabel(beds: Array<Pick<EditableBedModel, "label">>) {
  const baseLabel = "Nouveau lit";
  const existingLabels = new Set(
    beds.map((bed) => bed.label.trim().toLocaleLowerCase()),
  );

  if (!existingLabels.has(baseLabel.toLocaleLowerCase())) {
    return baseLabel;
  }

  let index = 2;

  while (existingLabels.has(`${baseLabel} ${index}`.toLocaleLowerCase())) {
    index += 1;
  }

  return `${baseLabel} ${index}`;
}

function nextBedSortOrder(beds: Array<Pick<EditableBedModel, "sortOrder">>) {
  const highestSortOrder = Math.max(0, ...beds.map((bed) => bed.sortOrder));

  return highestSortOrder + 1;
}

function createLocalId(prefix: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

  return `${prefix}-${randomId}`;
}

function positiveSortOrder(sortOrder: number) {
  return sortOrder > 0 ? sortOrder : undefined;
}

function compareBeds(left: Bed, right: Bed) {
  return (
    left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  );
}

function occupiedBedCount(beds: Bed[]) {
  return beds.filter((bed) => bed.occupiedPatientId).length;
}

function servicePatientsInVisit(patients: Patient[], serviceName: string) {
  return patients.filter(
    (patient) =>
      patient.currentService === serviceName && patient.currentVisitId,
  ).length;
}
