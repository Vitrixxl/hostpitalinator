import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  Check,
  BedIcon,
  ChevronDown,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import {
  createPatient,
  healthCheck,
  listBeds,
  listPatients,
  listServices,
  startNewPatientVisit,
} from "@/api";
import { ROLE_LABELS } from "@/app/constants";
import { formatDate, formatShortDateTime } from "@/app/date-utils";
import { errorMessage } from "@/app/error-utils";
import { emptyPatientForm } from "@/app/form-state";
import { bedLabel, optionalValue, patientSexLabel } from "@/app/formatters";
import { prefetchPatientWorkspace } from "@/app/patient-prefetch";
import type { PatientFormState } from "@/app/types";
import { AlertMessage, EmptyState } from "@/components/common/Feedback";
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
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminPanel } from "@/features/admin/components/AdminPanel";
import { PatientCreationPage } from "@/features/patients/components/PatientCreationPage";
import { PatientWorkspace } from "@/features/patients/components/PatientWorkspace";
import { cn } from "@/lib/utils";
import type { Account, Bed, Patient, PatientSex, Service } from "@/types";

type AppView = "patients" | "new-patient" | "admin";
type NewVisitMode = "choice" | "search";

export function AppShell({
  account,
  onLogout,
}: {
  account: Account;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeView: AppView = location.pathname.startsWith("/admin")
    ? "admin"
    : location.pathname.startsWith("/patients/new")
      ? "new-patient"
      : "patients";

  const [apiStatus, setApiStatus] = useState("verification");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState(account.service);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState("");
  const [patientForm, setPatientForm] = useState<PatientFormState>(
    emptyPatientForm(account.service),
  );
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [newVisitMode, setNewVisitMode] = useState<NewVisitMode>("search");
  const [newVisitBed, setNewVisitBed] = useState<Bed | null>(null);
  const [newVisitPatients, setNewVisitPatients] = useState<Patient[]>([]);
  const [newVisitSearch, setNewVisitSearch] = useState("");
  const [newVisitPatient, setNewVisitPatient] = useState<Patient | null>(null);
  const [newVisitLoading, setNewVisitLoading] = useState(false);
  const [newVisitSubmitting, setNewVisitSubmitting] = useState(false);
  const [newVisitError, setNewVisitError] = useState("");

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    setPatientError("");

    try {
      setPatients(
        await listPatients({
          q: search,
          includeArchived,
        }),
      );
    } catch (error) {
      setPatientError(errorMessage(error));
    } finally {
      setLoadingPatients(false);
    }
  }, [includeArchived, search]);

  const loadBeds = useCallback(async () => {
    try {
      setBeds(await listBeds({ service: selectedService }));
    } catch (error) {
      setPatientError(errorMessage(error));
    }
  }, [selectedService]);

  const loadServices = useCallback(async () => {
    try {
      const result = await listServices();
      setServices(result);
      setSelectedService((current) => {
        if (current && result.some((service) => service.name === current)) {
          return current;
        }

        return result[0]?.name ?? account.service;
      });
    } catch (error) {
      setPatientError(errorMessage(error));
    }
  }, [account.service]);

  const loadNewVisitPatients = useCallback(async () => {
    setNewVisitLoading(true);
    setNewVisitError("");

    try {
      setNewVisitPatients(
        await listPatients({
          q: newVisitSearch,
          includeArchived: true,
        }),
      );
    } catch (error) {
      setNewVisitError(errorMessage(error));
    } finally {
      setNewVisitLoading(false);
    }
  }, [newVisitSearch]);

  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus("connectee"))
      .catch(() => setApiStatus("indisponible"));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPatients();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [loadPatients]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBeds();
      void loadServices();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadBeds, loadServices]);

  useEffect(() => {
    if (!newVisitOpen || newVisitMode !== "search") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadNewVisitPatients();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [loadNewVisitPatients, newVisitMode, newVisitOpen]);

  async function handleCreatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPatientError("");

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
        currentService: patientForm.currentService || selectedService,
        administrativeInfo: optionalValue(patientForm.administrativeInfo),
        bedId: optionalValue(patientForm.bedId),
      });
      setPatientForm(emptyPatientForm(selectedService));
      await Promise.all([loadPatients(), loadBeds()]);
      navigate(`/patients/${created.id}/entrance`);
    } catch (error) {
      setPatientError(errorMessage(error));
    }
  }

  function handleNewVisitOpenChange(open: boolean) {
    setNewVisitOpen(open);

    if (!open) {
      setNewVisitPatient(null);
      setNewVisitBed(null);
      setNewVisitMode("search");
      setNewVisitSearch("");
      setNewVisitError("");
    }
  }

  function handleCreateVisit() {
    setNewVisitBed(null);
    setNewVisitMode("search");
    setNewVisitOpen(true);
  }

  function handleOpenFreeBed(bed: Bed) {
    setNewVisitBed(bed);
    setNewVisitMode("choice");
    setNewVisitOpen(true);
  }

  function handleCreatePatientFromBed(bed: Bed) {
    setPatientForm({
      ...emptyPatientForm(bed.service || selectedService),
      bedId: bed.id,
    });
    handleNewVisitOpenChange(false);
    navigate("/patients/new");
  }

  async function handleConfirmNewVisit() {
    if (!newVisitPatient) {
      return;
    }

    setNewVisitSubmitting(true);
    setNewVisitError("");

    try {
      const patient = await startNewPatientVisit(
        newVisitPatient.id,
        newVisitBed ? { bedId: newVisitBed.id } : undefined,
      );
      handleNewVisitOpenChange(false);
      await Promise.all([loadPatients(), loadBeds()]);
      navigate(`/patients/${patient.id}/entrance`);
    } catch (error) {
      setNewVisitError(errorMessage(error));
    } finally {
      setNewVisitSubmitting(false);
    }
  }

  function refreshPatientContext() {
    void loadPatients();
    void loadBeds();
    void loadServices();
  }

  const prefetchPatientDirectory = useCallback(() => {
    void loadPatients();
    void loadBeds();
    void loadServices();
  }, [loadBeds, loadPatients, loadServices]);

  const prefetchPatient = useCallback((patientId: string) => {
    prefetchPatientWorkspace(patientId);
  }, []);

  function handleSelectedServiceChange(service: string) {
    setSelectedService(service);
    setPatientForm((current) => ({
      ...current,
      currentService: service,
    }));
  }

  return (
    <main className="min-h-screen  text-foreground bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary),transparent_86%),transparent_34rem)]">
      <header className="  mx-auto min-w-0 max-w-7xl lg:p-8 p-4 !pb-0">
        <div className="flex min-h-16 items-center justify-between gap-4 rounded-3xl border bg-background p-4 shadow">
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

          <div className="flex min-w-0 items-center gap-2">
            <ServiceSearchPopover
              services={services}
              value={selectedService}
              onChange={handleSelectedServiceChange}
              disabled={services.length === 0}
            />
            <Button
              type="button"
              variant={activeView !== "admin" ? "default" : "outline"}
              onPointerEnter={prefetchPatientDirectory}
              onFocus={prefetchPatientDirectory}
              onClick={() => navigate("/patients")}
            >
              <Users className="size-4" />
              Patients
            </Button>
            {account.role === "admin" && (
              <Button
                type="button"
                variant={activeView === "admin" ? "default" : "outline"}
                onPointerEnter={() => void loadServices()}
                onFocus={() => void loadServices()}
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

      <div className="">
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
                  serviceName={selectedService}
                  includeArchived={includeArchived}
                  loadingPatients={loadingPatients}
                  patientError={patientError}
                  patients={patients}
                  search={search}
                  onCreatePatient={() => navigate("/patients/new")}
                  onCreateVisit={handleCreateVisit}
                  onIncludeArchivedChange={setIncludeArchived}
                  onOpenFreeBed={handleOpenFreeBed}
                  onOpenPatient={(patientId) =>
                    navigate(`/patients/${patientId}/summary`)
                  }
                  onPrefetchPatient={prefetchPatient}
                  onSearchChange={setSearch}
                />
              }
            />
            <Route path="*" element={<Navigate to="/patients" replace />} />
          </Routes>
        </section>
        <NewVisitDialog
          accountService={selectedService}
          beds={beds}
          error={newVisitError}
          loading={newVisitLoading}
          mode={newVisitMode}
          open={newVisitOpen}
          patients={newVisitPatients}
          search={newVisitSearch}
          selectedBed={newVisitBed}
          selectedPatient={newVisitPatient}
          submitting={newVisitSubmitting}
          onBack={() => setNewVisitPatient(null)}
          onConfirm={() => void handleConfirmNewVisit()}
          onCreatePatient={handleCreatePatientFromBed}
          onModeChange={setNewVisitMode}
          onOpenChange={handleNewVisitOpenChange}
          onPrefetchPatient={prefetchPatient}
          onRefresh={() => void loadNewVisitPatients()}
          onSearchChange={setNewVisitSearch}
          onSelectPatient={setNewVisitPatient}
        />
      </div>
    </main>
  );
}

function ServiceSearchPopover({
  services,
  value,
  onChange,
  disabled = false,
}: {
  services: Service[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredServices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const otherServices = services.filter((service) => service.name !== value);

    if (!normalizedQuery) {
      return otherServices;
    }

    return otherServices.filter((service) =>
      service.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [query, services, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setQuery("");
    }

    setOpen(nextOpen);
  }

  function handleSelect(serviceName: string) {
    onChange(serviceName);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="max-w-56 justify-between"
          disabled={disabled}
          aria-label="Sélectionner un service"
        >
          <Building2 className="size-4" />
          <span className="min-w-0 truncate">{value || "Service"}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            className="h-9 rounded-full pl-9"
            value={query}
            placeholder="Rechercher un service"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto">
          {filteredServices.length > 0 ? (
            filteredServices.map((service) => {
              const selected = service.name === value;

              return (
                <button
                  key={service.id}
                  type="button"
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-full px-3 text-left text-sm transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected && "bg-primary/10 text-primary",
                  )}
                  onClick={() => handleSelect(service.name)}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 truncate">{service.name}</span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Aucun service trouvé
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewVisitDialog({
  accountService,
  beds,
  error,
  loading,
  mode,
  open,
  patients,
  search,
  selectedBed,
  selectedPatient,
  submitting,
  onBack,
  onConfirm,
  onCreatePatient,
  onModeChange,
  onOpenChange,
  onPrefetchPatient,
  onRefresh,
  onSearchChange,
  onSelectPatient,
}: {
  accountService: string;
  beds: Bed[];
  error: string;
  loading: boolean;
  mode: NewVisitMode;
  open: boolean;
  patients: Patient[];
  search: string;
  selectedBed: Bed | null;
  selectedPatient: Patient | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onCreatePatient: (bed: Bed) => void;
  onModeChange: (mode: NewVisitMode) => void;
  onOpenChange: (open: boolean) => void;
  onPrefetchPatient: (patientId: string) => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  onSelectPatient: (patient: Patient) => void;
}) {
  const admissionService = selectedBed?.service ?? accountService;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {selectedPatient ? (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Confirmer la nouvelle entrée</DialogTitle>
              <DialogDescription>
                Validez que ce patient commence une nouvelle entrée dans votre
                service
                {selectedBed ? " et occupe le lit sélectionné." : "."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-background p-4 shadow">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                  {patientInitials(selectedPatient)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {selectedPatient.lastName} {selectedPatient.firstName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ne(e) le {formatDate(selectedPatient.birthDate)} ·{" "}
                    {patientSexLabel(selectedPatient.sex)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Service actuel {selectedPatient.currentService}
                    </Badge>
                    <Badge>Nouvelle entrée {admissionService}</Badge>
                    {selectedBed && (
                      <Badge variant="outline">
                        Chambre {selectedBed.room} · lit {selectedBed.label}
                      </Badge>
                    )}
                    {selectedPatient.archivedAt && (
                      <Badge variant="outline">Archive</Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Entrée courante{" "}
                    {selectedPatient.currentVisitId ?? "non renseignée"}
                    {selectedPatient.currentVisitStartedAt
                      ? ` · ${formatShortDateTime(
                          selectedPatient.currentVisitStartedAt,
                        )}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            {error && <AlertMessage message={error} />}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={onBack}
              >
                <ArrowLeft className="size-4" />
                Choisir un autre patient
              </Button>
              <Button type="button" disabled={submitting} onClick={onConfirm}>
                <Check className="size-4" />
                Confirmer
              </Button>
            </DialogFooter>
          </div>
        ) : mode === "choice" && selectedBed ? (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>
                Admission dans la chambre {selectedBed.room}
              </DialogTitle>
              <DialogDescription>
                Lit {selectedBed.label} disponible dans le service{" "}
                {selectedBed.service}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-background p-4 shadow">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BedIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    Chambre {selectedBed.room} · lit {selectedBed.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choisissez une fiche existante ou créez un nouveau dossier
                    patient avec ce lit présélectionné.
                  </p>
                </div>
              </div>
            </div>

            {error && <AlertMessage message={error} />}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onModeChange("search")}
              >
                <Search className="size-4" />
                Patient déjà venu
              </Button>
              <Button
                type="button"
                onClick={() => onCreatePatient(selectedBed)}
              >
                <Plus className="size-4" />
                Nouveau patient
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Nouvelle visite</DialogTitle>
              <DialogDescription>
                Choisissez le patient. Le service de la nouvelle entrée sera{" "}
                {admissionService}
                {selectedBed
                  ? `, avec le lit ${selectedBed.label} de la chambre ${selectedBed.room}.`
                  : "."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-input/60 bg-background shadow-inner shadow-muted/60 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20">
                <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
                <Input
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  placeholder="Rechercher un patient"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                disabled={loading}
                onClick={onRefresh}
                aria-label="Actualiser les patients"
              >
                <RefreshCw
                  className={cn("size-4", loading && "animate-spin")}
                />
              </Button>
            </div>

            {error && <AlertMessage message={error} />}

            <ScrollArea className="h-[24rem] rounded-xl border">
              {patients.length > 0 ? (
                <div className="divide-y">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      className="grid w-full gap-2 bg-background px-4 py-3 text-left transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onPointerEnter={() => onPrefetchPatient(patient.id)}
                      onFocus={() => onPrefetchPatient(patient.id)}
                      onClick={() => onSelectPatient(patient)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {patient.lastName} {patient.firstName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ne(e) le {formatDate(patient.birthDate)} ·{" "}
                            {patientSexLabel(patient.sex)}
                          </p>
                        </div>
                        <Badge
                          variant={patient.archivedAt ? "outline" : "default"}
                        >
                          {patient.archivedAt ? "Archive" : "Actif"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Service {patient.currentService}</span>
                        <span>Lit {bedLabel(beds, patient.bedId)}</span>
                        <span>
                          Entrée {patient.currentVisitId ?? "non renseignée"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[24rem] items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  {loading ? "Chargement des patients" : "Aucun patient trouvé"}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PatientDirectory({
  beds,
  serviceName,
  includeArchived,
  loadingPatients,
  patientError,
  patients,
  search,
  onCreatePatient,
  onCreateVisit,
  onIncludeArchivedChange,
  onOpenFreeBed,
  onOpenPatient,
  onPrefetchPatient,
  onSearchChange,
}: {
  beds: Bed[];
  serviceName: string;
  includeArchived: boolean;
  loadingPatients: boolean;
  patientError: string;
  patients: Patient[];
  search: string;
  onCreatePatient: () => void;
  onCreateVisit: () => void;
  onIncludeArchivedChange: (includeArchived: boolean) => void;
  onOpenFreeBed: (bed: Bed) => void;
  onOpenPatient: (patientId: string) => void;
  onPrefetchPatient: (patientId: string) => void;
  onSearchChange: (search: string) => void;
}) {
  const serviceBeds = useMemo(
    () =>
      serviceName ? beds.filter((bed) => bed.service === serviceName) : beds,
    [beds, serviceName],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-background p-4 shadow">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-4 ">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Users className="size-4" />
            </div>
            <div className="min-w-0 xl:w-64">
              <h1 className="truncate font-heading text-xl font-medium">
                Base de patients
              </h1>
            </div>
          </div>

          <PatientSearchPopover
            beds={beds}
            loading={loadingPatients}
            patients={patients}
            search={search}
            onOpenPatient={onOpenPatient}
            onPrefetchPatient={onPrefetchPatient}
            onSearchChange={onSearchChange}
          />

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={includeArchived}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full border px-4 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                includeArchived
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-input bg-background/70 text-muted-foreground hover:bg-muted/50",
              )}
              onClick={() => onIncludeArchivedChange(!includeArchived)}
            >
              Inclure archivés
            </button>
            <Button type="button" variant="outline" onClick={onCreateVisit}>
              <CalendarPlus className="size-4" />
              Nouvelle visite
            </Button>
            <Button type="button" onClick={onCreatePatient}>
              <Plus className="size-4" />
              Nouveau patient
            </Button>
          </div>
        </div>

        {patientError && (
          <div className="mt-4">
            <AlertMessage message={patientError} />
          </div>
        )}
      </section>

      <RoomBedOverview
        beds={serviceBeds}
        patients={patients}
        serviceName={serviceName}
        onOpenFreeBed={onOpenFreeBed}
        onOpenPatient={onOpenPatient}
        onPrefetchPatient={onPrefetchPatient}
      />
    </div>
  );
}

function PatientSearchPopover({
  beds,
  loading,
  patients,
  search,
  onOpenPatient,
  onPrefetchPatient,
  onSearchChange,
}: {
  beds: Bed[];
  loading: boolean;
  patients: Patient[];
  search: string;
  onOpenPatient: (patientId: string) => void;
  onPrefetchPatient: (patientId: string) => void;
  onSearchChange: (search: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const showResults = open && (loading || search.trim().length > 0);

  function handleOpenPatient(patientId: string) {
    setOpen(false);
    onOpenPatient(patientId);
  }

  return (
    <div className="min-w-0 flex-1">
      <Popover open={showResults} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="flex h-9 items-center rounded-full border border-input/60 bg-background/80 shadow-inner shadow-muted/60 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20 gap-2">
            <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
            <Input
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 md:text-sm"
              placeholder="Rechercher par nom ou prénom"
              value={search}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setOpen(true);
                onSearchChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popper-anchor-width)] p-2 rounded-xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="max-h-80 overflow-y-auto">
            {patients.length > 0 ? (
              <div className="grid gap-1">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    className="grid w-full gap-1 rounded-lg px-3 py-2 text-left transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onPointerEnter={() => onPrefetchPatient(patient.id)}
                    onFocus={() => onPrefetchPatient(patient.id)}
                    onClick={() => handleOpenPatient(patient.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">
                        {patient.lastName} {patient.firstName}
                      </span>
                      <Badge
                        variant={patient.archivedAt ? "outline" : "secondary"}
                      >
                        {patient.archivedAt ? "Archive" : "Actif"}
                      </Badge>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Ne(e) le {formatDate(patient.birthDate)}</span>
                      <span>{patientSexLabel(patient.sex)}</span>
                      <span>Service {patient.currentService}</span>
                      <span>Lit {bedLabel(beds, patient.bedId)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {loading ? "Chargement des patients" : "Aucun patient trouvé"}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RoomBedOverview({
  beds,
  patients,
  serviceName,
  onOpenFreeBed,
  onOpenPatient,
  onPrefetchPatient,
}: {
  beds: Bed[];
  patients: Patient[];
  serviceName: string;
  onOpenFreeBed: (bed: Bed) => void;
  onOpenPatient: (patientId: string) => void;
  onPrefetchPatient: (patientId: string) => void;
}) {
  const rooms = useMemo(() => groupBedsByRoom(beds), [beds]);
  const patientSexById = useMemo(
    () =>
      new Map(
        patients.flatMap((patient) =>
          patient.sex ? [[patient.id, patient.sex] as const] : [],
        ),
      ),
    [patients],
  );
  const occupiedCount = beds.filter((bed) => bed.occupiedPatientId).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border bg-background p-4 shadow sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BedIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-medium">
              Chambres du service{serviceName ? ` ${serviceName}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              {occupiedCount} lit{occupiedCount > 1 ? "s" : ""} occupé
              {occupiedCount > 1 ? "s" : ""} sur {beds.length}.
            </p>
          </div>
        </div>
      </div>

      {rooms.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.name}
              className="flex min-h-56 flex-col rounded-2xl border bg-background p-4 shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-heading text-lg font-medium">
                    Chambre {room.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {room.beds.length} lit{room.beds.length > 1 ? "s" : ""}
                  </p>
                </div>
                <Badge variant="secondary">
                  {room.beds.filter((bed) => bed.occupiedPatientId).length}/
                  {room.beds.length}
                </Badge>
              </div>

              <div className="mt-3 grid min-h-0 flex-1 content-start gap-2">
                {room.beds.map((bed) => {
                  const occupied = Boolean(bed.occupiedPatientId);
                  const patientSex =
                    bed.occupiedPatientSex ??
                    (bed.occupiedPatientId
                      ? patientSexById.get(bed.occupiedPatientId)
                      : null);
                  const occupiedStyle =
                    patientSex === "female"
                      ? "justify-between gap-3 border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-400/40 dark:bg-pink-950/30 dark:text-pink-200 dark:hover:bg-pink-950/40"
                      : "justify-between gap-3 border-primary/30 bg-primary/10 text-primary hover:bg-primary/15";

                  return (
                    <button
                      key={bed.id}
                      type="button"
                      className={cn(
                        "relative flex h-16 min-w-0 items-center rounded-xl border px-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        occupied
                          ? occupiedStyle
                          : "justify-center border-dashed border-input bg-transparent text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
                      )}
                      onPointerEnter={() => {
                        if (bed.occupiedPatientId) {
                          onPrefetchPatient(bed.occupiedPatientId);
                        }
                      }}
                      onFocus={() => {
                        if (bed.occupiedPatientId) {
                          onPrefetchPatient(bed.occupiedPatientId);
                        }
                      }}
                      onClick={() => {
                        if (bed.occupiedPatientId) {
                          onOpenPatient(bed.occupiedPatientId);
                        } else {
                          onOpenFreeBed(bed);
                        }
                      }}
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
                          <span className="shrink-0 text-xs">
                            Ouvrir dossier
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="absolute top-2 left-3 text-xs font-medium">
                            Lit {bed.label}
                          </span>
                          <Plus className="size-5" aria-hidden="true" />
                          <span className="sr-only">Admettre</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <EmptyState label="Aucune chambre dans ce service" />
        </div>
      )}
    </section>
  );
}

function groupBedsByRoom(beds: Bed[]) {
  const rooms = new Map<string, Bed[]>();

  for (const bed of beds) {
    const roomName = bed.room.trim() || "Non renseignée";
    rooms.set(roomName, [...(rooms.get(roomName) ?? []), bed]);
  }

  return [...rooms.entries()]
    .map(([name, roomBeds]) => ({
      name,
      beds: roomBeds.sort(compareBeds),
      sortOrder: Math.min(...roomBeds.map((bed) => bed.sortOrder)),
    }))
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
}

function compareBeds(left: Bed, right: Bed) {
  return (
    left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  );
}

function patientInitials(patient: Patient) {
  return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`
    .trim()
    .toUpperCase();
}

function PatientWorkspaceRoute({
  account,
  beds,
  services,
  onPatientChanged,
}: {
  account: Account;
  beds: Bed[];
  services: Service[];
  onPatientChanged: () => void;
}) {
  const { patientId } = useParams();

  if (!patientId) {
    return <Navigate to="/patients" replace />;
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
  );
}
