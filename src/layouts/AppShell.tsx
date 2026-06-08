import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
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
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

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
import {
  emptyPatientForm,
  patientContactPersonsFormToInput,
} from "@/app/form-state";
import { bedLabel, optionalValue, patientSexLabel } from "@/app/formatters";
import { prefetchPatientWorkspace } from "@/app/patient-prefetch";
import { richTextOptionalValue } from "@/app/rich-text";
import type { PatientFormState } from "@/app/types";
import { AlertMessage, EmptyState } from "@/components/common/Feedback";
import {
  QuickActionDialog,
  type QuickAction,
  type QuickActionPanel,
} from "@/components/common/QuickActionDialog";
import { RichTextDialogProvider } from "@/components/common/RichText";
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
import { PatientCreationPage } from "@/features/patients/components/PatientCreationPage";
import { cn } from "@/lib/utils";
import type {
  Account,
  Bed,
  Patient,
  PatientIdentifier,
  PatientSex,
  Service,
} from "@/types";

type AppView = "patients" | "new-patient" | "admin";
type NewVisitMode = "choice" | "search";
type PatientSearchTarget = "ipp" | "name";

const PATIENT_DIRECTORY_LIMIT = 80;
const NEW_VISIT_PATIENT_SEARCH_LIMIT = 50;
const PATIENT_PREFETCH_INTENT_DELAY_MS = 350;
const QUICK_ACTION_SURFACE_LAYOUT_ID = "global-quick-action-surface";
const QUICK_ACTION_BUTTON_WHILE_HOVER = { scale: 1.02 } as const;
const QUICK_ACTION_BUTTON_WHILE_TAP = { scale: 0.98 } as const;
const QUICK_ACTION_SPRING_TRANSITION = {
  type: "spring",
  stiffness: 430,
  damping: 34,
} as const;

const AdminPanel = lazy(() =>
  import("@/features/admin/components/AdminPanel").then((module) => ({
    default: module.AdminPanel,
  })),
);

const PatientWorkspace = lazy(() =>
  import("@/features/patients/components/PatientWorkspace").then((module) => ({
    default: module.PatientWorkspace,
  })),
);

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
  const activePatientRouteId = useMemo(
    () => patientIdFromWorkspacePath(location.pathname),
    [location.pathname],
  );

  const [apiStatus, setApiStatus] = useState("verification");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState(account.service);
  const [search, setSearch] = useState("");
  const [ippSearch, setIppSearch] = useState("");
  const [patientSearchFocusTarget, setPatientSearchFocusTarget] =
    useState<PatientSearchTarget | null>(null);
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
  const [newVisitIppSearch, setNewVisitIppSearch] = useState("");
  const [newVisitPatient, setNewVisitPatient] = useState<Patient | null>(null);
  const [newVisitLoading, setNewVisitLoading] = useState(false);
  const [newVisitSubmitting, setNewVisitSubmitting] = useState(false);
  const [newVisitError, setNewVisitError] = useState("");
  const [globalQuickActionOpen, setGlobalQuickActionOpen] = useState(false);
  const globalQuickActionOpenRef = useRef(false);
  const patientPrefetchTimeoutRef = useRef<number | undefined>(undefined);

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    setPatientError("");

    try {
      setPatients(
        await listPatients({
          ipp: ippSearch,
          q: search,
          limit: PATIENT_DIRECTORY_LIMIT,
        }),
      );
    } catch (error) {
      setPatientError(errorMessage(error));
    } finally {
      setLoadingPatients(false);
    }
  }, [ippSearch, search]);

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
          ipp: newVisitIppSearch,
          q: newVisitSearch,
          limit: NEW_VISIT_PATIENT_SEARCH_LIMIT,
        }),
      );
    } catch (error) {
      setNewVisitError(errorMessage(error));
    } finally {
      setNewVisitLoading(false);
    }
  }, [newVisitIppSearch, newVisitSearch]);

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
      void loadServices();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadServices]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBeds();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadBeds]);

  useEffect(() => {
    if (!newVisitOpen || newVisitMode !== "search") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadNewVisitPatients();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [loadNewVisitPatients, newVisitMode, newVisitOpen]);

  useEffect(() => {
    globalQuickActionOpenRef.current = globalQuickActionOpen;
  }, [globalQuickActionOpen]);

  useEffect(() => {
    return () => {
      if (patientPrefetchTimeoutRef.current !== undefined) {
        window.clearTimeout(patientPrefetchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (globalQuickActionOpenRef.current) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        setGlobalQuickActionOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });

    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  const handleCreatePatient = useCallback(async () => {
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
        administrativeInfo: richTextOptionalValue(
          patientForm.administrativeInfo,
        ),
        contactPersons: patientContactPersonsFormToInput(
          patientForm.contactPersons,
        ),
        bedId: optionalValue(patientForm.bedId),
      });
      setPatientForm(emptyPatientForm(selectedService));
      await Promise.all([loadPatients(), loadBeds()]);
      navigate(`/patients/${created.id}/entrance`);
    } catch (error) {
      setPatientError(errorMessage(error));
    }
  }, [loadBeds, loadPatients, navigate, patientForm, selectedService]);

  const handleNewVisitOpenChange = useCallback((open: boolean) => {
    setNewVisitOpen(open);

    if (!open) {
      setNewVisitPatient(null);
      setNewVisitBed(null);
      setNewVisitMode("search");
      setNewVisitSearch("");
      setNewVisitError("");
    }
  }, []);

  const handleCreateVisit = useCallback(() => {
    setNewVisitBed(null);
    setNewVisitMode("search");
    setNewVisitOpen(true);
  }, []);

  const handleOpenFreeBed = useCallback((bed: Bed) => {
    setNewVisitBed(bed);
    setNewVisitMode("choice");
    setNewVisitOpen(true);
  }, []);

  const handleCreatePatientFromBed = useCallback(
    (bed: Bed) => {
      setPatientForm({
        ...emptyPatientForm(bed.service || selectedService),
        bedId: bed.id,
      });
      handleNewVisitOpenChange(false);
      navigate("/patients/new");
    },
    [handleNewVisitOpenChange, navigate, selectedService],
  );

  const handleConfirmNewVisit = useCallback(async () => {
    if (!newVisitPatient) {
      return;
    }

    const admissionService = newVisitBed?.service ?? selectedService;
    const patientAlreadyInAdmissionService =
      Boolean(newVisitPatient.currentVisitId) &&
      newVisitPatient.currentService.trim() === admissionService.trim();

    if (patientAlreadyInAdmissionService) {
      setNewVisitError(
        `Cette personne est déjà dans le service ${admissionService}. Impossible de créer une nouvelle visite.`,
      );
      return;
    }

    setNewVisitSubmitting(true);
    setNewVisitError("");

    try {
      if (newVisitPatient.currentVisitId) {
        handleNewVisitOpenChange(false);
        navigate(`/patients/${newVisitPatient.id}/entrance`);
        return;
      }

      const patient = await startNewPatientVisit(newVisitPatient.id, {
        bedId: newVisitBed?.id,
      });
      handleNewVisitOpenChange(false);
      await Promise.all([loadPatients(), loadBeds()]);
      navigate(`/patients/${patient.id}/entrance`);
    } catch (error) {
      setNewVisitError(errorMessage(error));
    } finally {
      setNewVisitSubmitting(false);
    }
  }, [
    loadBeds,
    loadPatients,
    navigate,
    newVisitBed,
    newVisitPatient,
    selectedService,
    handleNewVisitOpenChange,
  ]);

  const refreshPatientContext = useCallback(() => {
    void loadPatients();
    void loadBeds();
    void loadServices();
  }, [loadBeds, loadPatients, loadServices]);

  const prefetchPatientDirectory = useCallback(() => {
    void loadPatients();
    void loadBeds();
    void loadServices();
  }, [loadBeds, loadPatients, loadServices]);

  const prefetchPatient = useCallback((patientId: PatientIdentifier) => {
    if (patientPrefetchTimeoutRef.current !== undefined) {
      window.clearTimeout(patientPrefetchTimeoutRef.current);
    }

    patientPrefetchTimeoutRef.current = window.setTimeout(() => {
      patientPrefetchTimeoutRef.current = undefined;
      prefetchPatientWorkspace(patientId);
    }, PATIENT_PREFETCH_INTENT_DELAY_MS);
  }, []);

  const handleSelectedServiceChange = useCallback((service: string) => {
    setSelectedService(service);
    setPatientForm((current) => ({
      ...current,
      currentService: service,
    }));
  }, []);

  const openPatientDirectory = useCallback(() => {
    navigate("/patients");
  }, [navigate]);

  const openAdmin = useCallback(() => {
    navigate("/admin");
  }, [navigate]);

  const openNewPatient = useCallback(() => {
    navigate("/patients/new");
  }, [navigate]);

  const openPatientSummary = useCallback(
    (patientId: PatientIdentifier) => {
      navigate(`/patients/${patientId}/summary`);
    },
    [navigate],
  );

  const openPatientSearch = useCallback(
    (target: PatientSearchTarget, query: string) => {
      const trimmedQuery = query.trim();

      if (target === "ipp") {
        setIppSearch(trimmedQuery);
        setSearch("");
      } else {
        setSearch(trimmedQuery);
        setIppSearch("");
      }

      setPatientSearchFocusTarget(target);
      navigate("/patients");
    },
    [navigate],
  );

  const openCurrentPatientLabRequest = useCallback(() => {
    if (!activePatientRouteId) {
      return;
    }

    navigate(`/patients/${activePatientRouteId}/labs`, {
      state: {
        patientWorkspaceAction: "request-lab",
        patientWorkspaceActionId:
          globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
      },
    });
  }, [activePatientRouteId, navigate]);

  const clearPatientSearchFocusTarget = useCallback(() => {
    setPatientSearchFocusTarget(null);
  }, []);

  const globalQuickActions = useMemo<QuickAction[]>(
    () => {
      const actions: QuickAction[] = [
        {
          id: "search-patient",
          label: "Rechercher un patient",
          detail: "Par IPP ou par nom",
          panelId: "patient-search",
        },
      ];

      if (activePatientRouteId) {
        actions.push({
          id: "request-lab-panel",
          label: "Demander un bilan",
          detail: "Créer une demande de biologie pour ce patient",
          run: openCurrentPatientLabRequest,
        });
      }

      actions.push({
        id: "change-selected-service",
        label: "Modifier le service sélectionné",
        detail: selectedService
          ? `Service actuel : ${selectedService}`
          : "Aucun service sélectionné",
        disabled: services.length === 0,
        panelId: "services",
      });

      return actions;
    },
    [
      activePatientRouteId,
      openCurrentPatientLabRequest,
      selectedService,
      services.length,
    ],
  );

  const globalQuickActionPanels = useMemo<QuickActionPanel[]>(
    () => [
      {
        id: "patient-search",
        label: "Recherche patient",
        placeholder: "Saisir l'IPP ou le nom...",
        emptyLabel: "Aucun mode de recherche trouvé.",
        queryMode: "input",
        items: [
          {
            id: "patient-search-ipp",
            label: "Par IPP",
            value: "ipp",
          },
          {
            id: "patient-search-name",
            label: "Par nom",
            value: "name",
          },
        ],
        onSelect: (item, query) =>
          openPatientSearch(item.value as PatientSearchTarget, query),
      },
      {
        id: "services",
        label: "Services",
        placeholder: "Filtrer les services...",
        emptyLabel: "Aucun service trouvé.",
        selectedValue: selectedService,
        items: services.map((service) => ({
          id: service.id,
          label: service.name,
          value: service.name,
        })),
        onSelect: (service) => handleSelectedServiceChange(service.value),
      },
    ],
    [handleSelectedServiceChange, openPatientSearch, selectedService, services],
  );

  return (
    <RichTextDialogProvider>
      <main className="min-h-screen bg-canvas text-foreground grid grid-rows-[auto_1fr]">
        <AppHeader
          account={account}
          activeView={activeView}
          apiStatus={apiStatus}
          onAdminPrefetch={loadServices}
          onLogout={onLogout}
          onOpenAdmin={openAdmin}
          onOpenPatients={openPatientDirectory}
          onPatientDirectoryPrefetch={prefetchPatientDirectory}
        />

        <div className="min-h-full">
          <section className="mx-auto min-w-0 max-w-7xl px-4 pt-4 pb-28 lg:px-6 lg:pt-6 lg:pb-32 min-h-full">
            <Suspense fallback={<RouteLoadingState />}>
              <Routes>
                <Route index element={<Navigate to="/patients" replace />} />
                <Route
                  path="/admin/*"
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
                      services={services}
                      loadingPatients={loadingPatients}
                      patientError={patientError}
                      patients={patients}
                      patientSearchFocusTarget={patientSearchFocusTarget}
                      ippSearch={ippSearch}
                      search={search}
                      onCreatePatient={openNewPatient}
                      onCreateVisit={handleCreateVisit}
                      onOpenFreeBed={handleOpenFreeBed}
                      onOpenPatient={openPatientSummary}
                      onPrefetchPatient={prefetchPatient}
                      onPatientSearchFocusConsumed={
                        clearPatientSearchFocusTarget
                      }
                      onIppSearchChange={setIppSearch}
                      onSearchChange={setSearch}
                      onServiceChange={handleSelectedServiceChange}
                    />
                  }
                />
                <Route path="*" element={<Navigate to="/patients" replace />} />
              </Routes>
            </Suspense>
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
            onIppSearchChange={setNewVisitIppSearch}
            onModeChange={setNewVisitMode}
            onOpenChange={handleNewVisitOpenChange}
            onPrefetchPatient={prefetchPatient}
            onRefresh={() => void loadNewVisitPatients()}
            ippSearch={newVisitIppSearch}
            onSearchChange={setNewVisitSearch}
            onSelectPatient={setNewVisitPatient}
          />
          <GlobalQuickActionLauncher
            open={globalQuickActionOpen}
            actions={globalQuickActions}
            onOpenChange={setGlobalQuickActionOpen}
            panels={globalQuickActionPanels}
          />
        </div>
      </main>
    </RichTextDialogProvider>
  );
}

function RouteLoadingState() {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Chargement
    </div>
  );
}

function AppHeader({
  account,
  activeView,
  apiStatus,
  onAdminPrefetch,
  onLogout,
  onOpenAdmin,
  onOpenPatients,
  onPatientDirectoryPrefetch,
}: {
  account: Account;
  activeView: AppView;
  apiStatus: string;
  onAdminPrefetch: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenPatients: () => void;
  onPatientDirectoryPrefetch: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground">
            <span className="text-xs font-semibold">CH</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-medium">
              CH de Versailles
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {account.name} · {ROLE_LABELS[account.role]} · API {apiStatus}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant={activeView !== "admin" ? "default" : "outline"}
            onPointerEnter={onPatientDirectoryPrefetch}
            onFocus={onPatientDirectoryPrefetch}
            onClick={onOpenPatients}
          >
            <Users className="size-4" />
            Patients
          </Button>
          {account.role === "admin" && (
            <Button
              type="button"
              variant={activeView === "admin" ? "default" : "outline"}
              onPointerEnter={onAdminPrefetch}
              onFocus={onAdminPrefetch}
              onClick={onOpenAdmin}
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
  );
}

function GlobalQuickActionLauncher({
  actions,
  open,
  onOpenChange,
  panels,
}: {
  actions: QuickAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panels: QuickActionPanel[];
}) {
  return (
    <LayoutGroup id="global-quick-action">
      <div className="fixed bottom-4 left-1/2 z-40 w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 sm:bottom-6">
        <AnimatePresence initial={false}>
          {!open && (
            <motion.button
              key="global-quick-action-launcher"
              layoutId={QUICK_ACTION_SURFACE_LAYOUT_ID}
              type="button"
              className="flex h-10 w-full items-center gap-3 rounded-md border border-input/60 bg-background/90 px-3 text-sm text-muted-foreground shadow-lg shadow-foreground/10 backdrop-blur transition-[color,box-shadow] hover:bg-background focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary/20 focus-visible:outline-none"
              onClick={() => onOpenChange(true)}
              whileHover={QUICK_ACTION_BUTTON_WHILE_HOVER}
              whileTap={QUICK_ACTION_BUTTON_WHILE_TAP}
              transition={QUICK_ACTION_SPRING_TRANSITION}
              aria-label="Ouvrir les actions rapides"
            >
              <Search className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">
                Actions rapides
              </span>
              <kbd className="shrink-0 rounded-lg bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                Ctrl+K
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <QuickActionDialog
        open={open}
        actions={actions}
        onOpenChange={onOpenChange}
        panels={panels}
        surfaceLayoutId={QUICK_ACTION_SURFACE_LAYOUT_ID}
      />
    </LayoutGroup>
  );
}

function ServiceSearchPopover({
  className,
  services,
  value,
  onChange,
  disabled = false,
}: {
  className?: string;
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
          className={cn("max-w-56 justify-between", className)}
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
            className="h-9 rounded-md pl-9"
            value={query}
            placeholder="Rechercher un service"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <ScrollArea className="mt-2 max-h-64">
          {filteredServices.length > 0 ? (
            filteredServices.map((service) => {
              const selected = service.name === value;

              return (
                <button
                  key={service.id}
                  type="button"
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
        </ScrollArea>
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
  ippSearch,
  search,
  selectedBed,
  selectedPatient,
  submitting,
  onBack,
  onConfirm,
  onCreatePatient,
  onIppSearchChange,
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
  ippSearch: string;
  search: string;
  selectedBed: Bed | null;
  selectedPatient: Patient | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onCreatePatient: (bed: Bed) => void;
  onIppSearchChange: (search: string) => void;
  onModeChange: (mode: NewVisitMode) => void;
  onOpenChange: (open: boolean) => void;
  onPrefetchPatient: (patientId: PatientIdentifier) => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  onSelectPatient: (patient: Patient) => void;
}) {
  const admissionService = selectedBed?.service ?? accountService;
  const selectedPatientHasActiveVisit = Boolean(
    selectedPatient?.currentVisitId,
  );
  const selectedPatientAlreadyInAdmissionService =
    selectedPatient != null &&
    selectedPatientHasActiveVisit &&
    selectedPatient.currentService.trim() === admissionService.trim();
  const selectedPatientActionLabel = selectedPatientAlreadyInAdmissionService
    ? "Déjà dans ce service"
    : selectedPatientHasActiveVisit
      ? "Préparer l'entrée"
      : "Nouvelle entrée";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {selectedPatient ? (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>
                {selectedPatientAlreadyInAdmissionService
                  ? "Patient déjà dans le service"
                  : selectedPatientHasActiveVisit
                  ? "Préparer l'entrée"
                  : "Confirmer la nouvelle entrée"}
              </DialogTitle>
              <DialogDescription>
                {selectedPatientAlreadyInAdmissionService
                  ? `Cette personne est déjà dans le service ${admissionService}. Impossible de créer une nouvelle visite.`
                  : selectedPatientHasActiveVisit
                  ? "Ouvrez le compte rendu d'entrée actuel avant de préparer une entrée dans votre service."
                  : `Validez que ce patient commence une nouvelle entrée dans votre service${
                      selectedBed ? " et occupe le lit sélectionné." : "."
                    }`}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-card p-3">
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
                    <Badge variant="outline">IPP {selectedPatient.id}</Badge>
                    <Badge variant="secondary">
                      Service actuel {selectedPatient.currentService}
                    </Badge>
                    <Badge
                      variant={
                        selectedPatientAlreadyInAdmissionService
                          ? "destructive"
                          : "default"
                      }
                    >
                      {selectedPatientAlreadyInAdmissionService
                        ? selectedPatientActionLabel
                        : `${selectedPatientActionLabel} ${admissionService}`}
                    </Badge>
                    {selectedBed && (
                      <Badge variant="outline">
                        Chambre {selectedBed.room} · lit {selectedBed.label}
                      </Badge>
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

            {error && !selectedPatientAlreadyInAdmissionService && (
              <AlertMessage message={error} />
            )}
            {selectedPatientAlreadyInAdmissionService && (
              <AlertMessage
                message={`Cette personne est déjà dans le service ${admissionService}. Impossible de créer une nouvelle visite.`}
              />
            )}

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
              <Button
                type="button"
                disabled={submitting || selectedPatientAlreadyInAdmissionService}
                onClick={onConfirm}
              >
                <Check className="size-4" />
                {selectedPatientActionLabel}
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

            <div className="rounded-lg border border-border bg-card p-3">
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
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex h-10 w-24 shrink-0 items-center rounded-md border border-input/60 bg-muted/70 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20 dark:bg-muted sm:w-28">
                  <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
                  <Input
                    aria-label="Recherche par IPP"
                    className="h-full w-full border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
                    inputMode="numeric"
                    placeholder="IPP"
                    value={ippSearch}
                    onChange={(event) => onIppSearchChange(event.target.value)}
                  />
                </div>
                <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-input/60 bg-muted/70 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20 dark:bg-muted gap-2">
                  <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
                  <Input
                    aria-label="Recherche par nom ou prénom"
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                    placeholder="Nom ou prénom"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                  />
                </div>
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
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>IPP {patient.id}</span>
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
  services,
  loadingPatients,
  patientError,
  patients,
  patientSearchFocusTarget,
  ippSearch,
  search,
  onCreatePatient,
  onCreateVisit,
  onOpenFreeBed,
  onOpenPatient,
  onPrefetchPatient,
  onPatientSearchFocusConsumed,
  onIppSearchChange,
  onSearchChange,
  onServiceChange,
}: {
  beds: Bed[];
  serviceName: string;
  services: Service[];
  loadingPatients: boolean;
  patientError: string;
  patients: Patient[];
  patientSearchFocusTarget: PatientSearchTarget | null;
  ippSearch: string;
  search: string;
  onCreatePatient: () => void;
  onCreateVisit: () => void;
  onOpenFreeBed: (bed: Bed) => void;
  onOpenPatient: (patientId: PatientIdentifier) => void;
  onPrefetchPatient: (patientId: PatientIdentifier) => void;
  onPatientSearchFocusConsumed: () => void;
  onIppSearchChange: (search: string) => void;
  onSearchChange: (search: string) => void;
  onServiceChange: (service: string) => void;
}) {
  const serviceBeds = useMemo(
    () =>
      serviceName ? beds.filter((bed) => bed.service === serviceName) : beds,
    [beds, serviceName],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-medium">
            Base de patients
          </h1>
          <p className="text-sm text-muted-foreground">
            {serviceName ? `Service ${serviceName}` : "Tous les services"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
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

      <PatientSearchPopover
        beds={beds}
        loading={loadingPatients}
        patients={patients}
        focusTarget={patientSearchFocusTarget}
        ippSearch={ippSearch}
        search={search}
        onOpenPatient={onOpenPatient}
        onPrefetchPatient={onPrefetchPatient}
        onFocusConsumed={onPatientSearchFocusConsumed}
        onIppSearchChange={onIppSearchChange}
        onSearchChange={onSearchChange}
      />

      {patientError && <AlertMessage message={patientError} />}

      <RoomBedOverview
        beds={serviceBeds}
        patients={patients}
        serviceName={serviceName}
        services={services}
        onOpenFreeBed={onOpenFreeBed}
        onOpenPatient={onOpenPatient}
        onPrefetchPatient={onPrefetchPatient}
        onServiceChange={onServiceChange}
      />
    </div>
  );
}

function PatientSearchPopover({
  beds,
  loading,
  patients,
  focusTarget,
  ippSearch,
  search,
  onOpenPatient,
  onPrefetchPatient,
  onFocusConsumed,
  onIppSearchChange,
  onSearchChange,
}: {
  beds: Bed[];
  loading: boolean;
  patients: Patient[];
  focusTarget: PatientSearchTarget | null;
  ippSearch: string;
  search: string;
  onOpenPatient: (patientId: PatientIdentifier) => void;
  onPrefetchPatient: (patientId: PatientIdentifier) => void;
  onFocusConsumed: () => void;
  onIppSearchChange: (search: string) => void;
  onSearchChange: (search: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ippInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const hasSearch = search.trim().length > 0 || ippSearch.trim().length > 0;
  const showResults = open && (loading || hasSearch);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const input =
        focusTarget === "ipp" ? ippInputRef.current : nameInputRef.current;
      input?.focus();
      input?.select();
      setOpen(true);
      onFocusConsumed();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [focusTarget, onFocusConsumed]);

  function handleOpenPatient(patientId: PatientIdentifier) {
    setOpen(false);
    onOpenPatient(patientId);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <Popover open={showResults} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-24 shrink-0 items-center rounded-md border border-input/60 bg-muted/70 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20 dark:bg-muted sm:w-28">
              <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={ippInputRef}
                aria-label="Recherche par IPP"
                className="h-full w-full border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
                inputMode="numeric"
                placeholder="IPP"
                value={ippSearch}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                  setOpen(true);
                  onIppSearchChange(event.target.value);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-input/60 bg-muted/70 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-primary/20 dark:bg-muted gap-2">
              <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={nameInputRef}
                aria-label="Recherche par nom ou prénom"
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
                placeholder="Nom ou prénom"
                value={search}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                  setOpen(true);
                  onSearchChange(event.target.value);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popper-anchor-width)] rounded-xl p-2 text-sm"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ScrollArea className="max-h-80">
            {patients.length > 0 ? (
              <div className="grid gap-1">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    className="grid w-full gap-1 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onPointerEnter={() => onPrefetchPatient(patient.id)}
                    onFocus={() => onPrefetchPatient(patient.id)}
                    onClick={() => handleOpenPatient(patient.id)}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {patient.lastName} {patient.firstName}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>IPP {patient.id}</span>
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
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RoomBedOverview({
  beds,
  patients,
  serviceName,
  services,
  onOpenFreeBed,
  onOpenPatient,
  onPrefetchPatient,
  onServiceChange,
}: {
  beds: Bed[];
  patients: Patient[];
  serviceName: string;
  services: Service[];
  onOpenFreeBed: (bed: Bed) => void;
  onOpenPatient: (patientId: PatientIdentifier) => void;
  onPrefetchPatient: (patientId: PatientIdentifier) => void;
  onServiceChange: (service: string) => void;
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
    <section className="space-y-3">
      <div className="flex flex-col gap-3 border-b border-border pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-base font-medium">
            <BedIcon className="size-4 text-muted-foreground" />
            Chambres
          </h2>
          <p className="text-xs text-muted-foreground">
            {occupiedCount} / {beds.length} lit{beds.length > 1 ? "s" : ""}{" "}
            occupé{occupiedCount > 1 ? "s" : ""}
          </p>
        </div>
        <ServiceSearchPopover
          className="w-full max-w-full sm:w-64"
          services={services}
          value={serviceName}
          onChange={onServiceChange}
          disabled={services.length === 0}
        />
      </div>

      {rooms.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rooms.map((room) => (
            <div
              key={room.name}
              className="flex min-h-56 flex-col rounded-lg border border-border bg-card p-3"
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
                      : patientSex === "male"
                        ? "justify-between gap-3 border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/40"
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

function patientIdFromWorkspacePath(pathname: string) {
  const match = pathname.match(/^\/patients\/([^/]+)(?:\/[^/]+)?$/);
  const patientId = match?.[1];

  return patientId && patientId !== "new" ? patientId : null;
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
