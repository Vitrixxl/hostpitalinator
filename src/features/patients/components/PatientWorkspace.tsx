import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  Activity,
  ArrowLeft,
  ArrowRightLeft,
  BedIcon,
  BellRing,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  FlaskConical,
  ListFilter,
  LogOutIcon,
  Mars,
  Pencil,
  Plus,
  Save,
  ScanLine,
  Search,
  Stethoscope,
  Thermometer,
  Trash2,
  Venus,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";

import {
  addEvolutionNote,
  addLabResult,
  addMedicalDocument,
  addPatientDoctorFollowup,
  addPrescription,
  addVitalRecord,
  deletePatientDoctorFollowup,
  deleteVitalRecord,
  downloadMedicalDocument,
  endPatientVisit,
  getEntranceExam,
  getPatient,
  listEvolutionNotes,
  listEntranceExams,
  listLabResults,
  listMedicalDocuments,
  listPatientDoctorFollowups,
  listPrescriptions,
  listVitalRecords,
  openMedicalDocument,
  saveEntranceExam,
  searchDoctors,
  setRealtimeContext,
  startNewPatientVisit,
  subscribeRealtime,
  type RealtimeEvent,
  updatePatient,
  updatePatientDoctorFollowup,
  updateLabResult,
  updatePrescriptionStatus,
  updateVitalRecord,
} from "@/api";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  LAB_STATUSES,
  PATIENT_TAB_VALUES,
  PATIENT_TABS,
  PRESCRIPTION_STATUSES,
  ROLE_LABELS,
} from "@/app/constants";
import {
  dateInput,
  formatDate,
  formatEvolutionNoteDay,
  formatEvolutionNoteMonth,
  formatEvolutionNoteTime,
  formatShortDateTime,
  nowLocalInput,
} from "@/app/date-utils";
import { errorMessage } from "@/app/error-utils";
import { filenameFromDisposition, readFileAsDataUrl } from "@/app/file-utils";
import {
  richTextNullableOptionalValue,
  richTextOptionalValue,
  richTextToPlainText,
} from "@/app/rich-text";
import {
  defaultVisitId,
  emptyDocumentForm,
  emptyDoctorFollowupForm,
  emptyEntranceExamForm,
  emptyLabForm,
  emptyPatientForm,
  emptyPrescriptionFilters,
  emptyPrescriptionForm,
  emptyVitalForm,
  entranceExamFormToInput,
  entranceExamToForm,
  patientContactPersonsFormToInput,
  patientToForm,
  prescriptionEndDateFromDuration,
  trimPrescriptionMedicationForm,
  vitalFormToInput,
  vitalRecordToForm,
} from "@/app/form-state";
import {
  bedLabel,
  bedLabelText,
  formatFileSize,
  nullableOptionalValue,
  optionalValue,
  patientSexLabel,
  prescriptionStatusLabel,
  textIncludes,
} from "@/app/formatters";
import {
  emptyLabMarkerRangeFilter,
  formatLabPanelPreview,
  hasLabMarkerRangeFilter,
  labFormResultsToInput,
  labStatusLabel,
  parseLabNumericValue,
  parseOptionalNumberFilter,
  worstLabStatus,
} from "@/app/lab-utils";
import { realtimePageForPatientTab } from "@/app/realtime";
import {
  getPatientWorkspaceSnapshot,
  invalidatePatientWorkspaceSnapshot,
  peekPatientWorkspaceSnapshot,
  type PatientWorkspaceSnapshot,
} from "@/app/patient-prefetch";
import type {
  DocumentFormState,
  DoctorFollowupFormState,
  EntranceExamFormState,
  LabFormState,
  LabMarkerRangeFilter,
  PatientFormState,
  PatientTab,
  PrescriptionFilters,
  PrescriptionFormState,
  VitalChartPoint,
  VitalChartPanel,
  VitalFormState,
} from "@/app/types";
import {
  MedicalColumnHead,
  PatientInfoBadge,
} from "@/components/common/Display";
import {
  AlertMessage,
  EmptyState,
  StatusBadge,
} from "@/components/common/Feedback";
import { Field } from "@/components/common/Field";
import {
  DateTextInput,
  DateTimeTextInput,
} from "@/components/common/DateInputs";
import { NumberField } from "@/components/common/FormControls";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import {
  RichTextDisplay,
  RichTextNoteField,
} from "@/components/common/RichText";
import { useRichTextDialog } from "@/components/common/rich-text-dialog-context";
import { SectionTitle } from "@/components/common/SectionTitle";
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
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LabPanelDetailsDialog } from "@/features/labs/components/LabPanelDetailsDialog";
import { LabPanelDialog } from "@/features/labs/components/LabPanelDialog";
import { canOpenDicomViewer } from "@/features/documents/imaging-document-utils";
import { EntranceExamPanel } from "./EntranceExamPanel";
import { PatientFormFields } from "./PatientFormFields";
import { PrescriptionForm } from "@/features/prescriptions/components/PrescriptionForm";
import { VitalMeasureChart } from "@/features/vitals/components/VitalMeasureChart";
import { cn } from "@/lib/utils";
import { LAB_PANEL_TYPES, labPanelDefinition } from "@/types";
import type {
  Account,
  Bed,
  Doctor,
  EvolutionNote,
  EntranceExamRecord,
  LabPanel,
  LabStatus,
  LabPanelType,
  MedicalDocument,
  MedicalDocumentCategory,
  Patient,
  PatientDoctorFollowup,
  PatientSex,
  Prescription,
  Service,
  UserRole,
  VitalRecord,
} from "@/types";

const PATIENT_TAB_TRANSITION = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
} as const;

const LAB_PANEL_LIST_TABS = [
  { value: "requests", label: "Demandes" },
  { value: "completed", label: "Remplis" },
] as const;

type LabPanelListTab = (typeof LAB_PANEL_LIST_TABS)[number]["value"];

type LabPanelFilters = {
  panelType: LabPanelType | "all";
  status: LabStatus | "all";
  markerFilters: Record<string, LabMarkerRangeFilter>;
};

function emptyLabPanelFilters(): LabPanelFilters {
  return {
    panelType: "all",
    status: "all",
    markerFilters: {},
  };
}

function isLabPanelListTab(value: string): value is LabPanelListTab {
  return value === "requests" || value === "completed";
}

function labPanelMatchesFilters(panel: LabPanel, filters: LabPanelFilters) {
  if (filters.panelType !== "all" && panel.panelType !== filters.panelType) {
    return false;
  }

  if (filters.status !== "all" && panel.status !== filters.status) {
    return false;
  }

  if (filters.panelType === "all") {
    return true;
  }

  const activeMarkerFilters = labPanelDefinition(filters.panelType)
    .markers.map((marker) => ({
      markerKey: marker.key,
      filter: filters.markerFilters[marker.key],
    }))
    .filter(
      (item): item is { markerKey: string; filter: LabMarkerRangeFilter } =>
        hasLabMarkerRangeFilter(item.filter),
    );

  if (activeMarkerFilters.length === 0) {
    return true;
  }

  return activeMarkerFilters.every(({ markerKey, filter }) => {
    const result = panel.results.find(
      (panelResult) => panelResult.markerKey === markerKey,
    );

    if (!result) {
      return false;
    }

    const resultValue = parseLabNumericValue(result.value);

    if (resultValue == null) {
      return false;
    }

    const minimumValue = parseOptionalNumberFilter(filter.min);
    const maximumValue = parseOptionalNumberFilter(filter.max);

    if (minimumValue != null && resultValue < minimumValue) {
      return false;
    }

    if (maximumValue != null && resultValue > maximumValue) {
      return false;
    }

    return true;
  });
}

const patientTabVariants = {
  enter: (direction: "forward" | "backward") => ({
    y: direction === "forward" ? "-100%" : "100%",
  }),
  center: {
    y: 0,
  },
  exit: (direction: "forward" | "backward") => ({
    y: direction === "forward" ? "100%" : "-100%",
  }),
};

const PATIENT_UPDATE_TOAST_DURATION_MS = 4200;
const ENTRANCE_EXAM_HISTORY_PAGE_SIZE = 5;
const VITAL_RECORD_EDIT_WINDOW_MS = 30 * 60 * 1000;
const VITAL_RECORD_EDIT_REFRESH_INTERVAL_MS = 60 * 1000;
const VITAL_RECORD_EDIT_EXPIRED_MESSAGE =
  "Cette mesure n'est plus modifiable après 30 minutes.";

const DicomImageViewerDialog = lazy(() =>
  import("@/features/documents/components/DicomImageViewerDialog").then(
    (module) => ({ default: module.DicomImageViewerDialog }),
  ),
);

type PatientUpdateToast = {
  id: string;
  detail: string;
};

type PatientWorkspaceLocationState = {
  patientWorkspaceAction?: "request-lab";
  patientWorkspaceActionId?: string;
} | null;

const EVOLUTION_ACTIVE_SERVICE_FILTER = "__active_service__";
type EvolutionNoteRoleFilter = Extract<UserRole, "doctor" | "nurse"> | "other";
type VitalStatusSeverity = 0 | 1 | 2 | 3 | 4;
type VitalStatus = {
  label: string;
  severity: VitalStatusSeverity;
};
type VitalSummaryItem = {
  label: string;
  value: string;
  statusLabel?: string;
  statusSeverity?: VitalStatusSeverity;
  spanTwoColumns?: boolean;
};

const VITAL_STATUS_CLASS_BY_SEVERITY: Record<VitalStatusSeverity, string> = {
  0: "border-emerald-500/75 bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/15 dark:border-emerald-400/70 dark:bg-emerald-500/15",
  1: "border-lime-500/75 bg-lime-500/10 ring-1 ring-inset ring-lime-500/15 dark:border-lime-400/70 dark:bg-lime-500/15",
  2: "border-amber-500/80 bg-amber-500/15 ring-1 ring-inset ring-amber-500/20 dark:border-amber-400/75 dark:bg-amber-500/20",
  3: "border-orange-600/85 bg-orange-500/15 ring-1 ring-inset ring-orange-500/20 dark:border-orange-400/80 dark:bg-orange-500/20",
  4: "border-red-600/90 bg-red-500/15 ring-1 ring-inset ring-red-500/25 dark:border-red-400/85 dark:bg-red-500/25",
};

function vitalStatusClass(severity?: VitalStatusSeverity) {
  return severity == null ? "" : VITAL_STATUS_CLASS_BY_SEVERITY[severity];
}

export function PatientWorkspace({
  patientId,
  currentAccount,
  beds,
  services,
  onPatientChanged,
}: {
  patientId: string;
  currentAccount: Account;
  beds: Bed[];
  services: Service[];
  onPatientChanged: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const openRichTextDialog = useRichTextDialog();
  const { tab } = useParams();
  const activeTabFromRoute = isPatientTab(tab) ? tab : null;
  const activeTab = activeTabFromRoute ?? "summary";
  const activeTabIndex = PATIENT_TAB_VALUES.indexOf(activeTab);
  const previousTabIndexRef = useRef(activeTabIndex);
  const [tabDirection, setTabDirection] = useState<"forward" | "backward">(
    "forward",
  );
  const [patient, setPatient] = useState<Patient | null>(null);
  const [latestVital, setLatestVital] = useState<VitalRecord | null>(null);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patientDoctorFollowups, setPatientDoctorFollowups] = useState<
    PatientDoctorFollowup[]
  >([]);
  const [labs, setLabs] = useState<LabPanel[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [notes, setNotes] = useState<EvolutionNote[]>([]);
  const [entranceExamForm, setEntranceExamForm] =
    useState<EntranceExamFormState>(emptyEntranceExamForm());
  const [hasCurrentEntranceExam, setHasCurrentEntranceExam] = useState(false);
  const [entranceExamHistory, setEntranceExamHistory] = useState<
    EntranceExamRecord[]
  >([]);
  const [loadingEntranceExamHistory, setLoadingEntranceExamHistory] =
    useState(false);
  const [hasMoreEntranceExams, setHasMoreEntranceExams] = useState(true);
  const [selectedLabPanel, setSelectedLabPanel] = useState<LabPanel | null>(
    null,
  );
  const [selectedEvolutionNote, setSelectedEvolutionNote] =
    useState<EvolutionNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [documentFilter, setDocumentFilter] = useState<
    MedicalDocumentCategory | "all"
  >("all");
  const [documentNoteSearch, setDocumentNoteSearch] = useState("");
  const [activeLabPanelTab, setActiveLabPanelTab] =
    useState<LabPanelListTab>("requests");
  const [labPanelFilters, setLabPanelFilters] = useState<
    Record<LabPanelListTab, LabPanelFilters>
  >({
    requests: emptyLabPanelFilters(),
    completed: emptyLabPanelFilters(),
  });
  const [evolutionSearch, setEvolutionSearch] = useState("");
  const [evolutionServiceFilter, setEvolutionServiceFilter] = useState(
    EVOLUTION_ACTIVE_SERVICE_FILTER,
  );
  const [evolutionNoteRoleFilter, setEvolutionNoteRoleFilter] =
    useState<EvolutionNoteRoleFilter>("doctor");
  const [prescriptionFilters, setPrescriptionFilters] =
    useState<PrescriptionFilters>(emptyPrescriptionFilters());
  const [doctorSpecialtyFilter, setDoctorSpecialtyFilter] = useState("all");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorSearchResults, setDoctorSearchResults] = useState<Doctor[]>([]);
  const [doctorSearchLoading, setDoctorSearchLoading] = useState(false);
  const [patientForm, setPatientForm] =
    useState<PatientFormState>(emptyPatientForm());
  const patientDetailsForm = useForm<PatientFormState>({
    values: patientForm,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [placementBedId, setPlacementBedId] = useState("");
  const [endVisitDialogOpen, setEndVisitDialogOpen] = useState(false);
  const [newVisitDialogOpen, setNewVisitDialogOpen] = useState(false);
  const [vitalForm, setVitalForm] = useState<VitalFormState>(emptyVitalForm());
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null);
  const [vitalDialogOpen, setVitalDialogOpen] = useState(false);
  const [vitalEditNow, setVitalEditNow] = useState(() => Date.now());
  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);
  const [editingDoctorFollowupId, setEditingDoctorFollowupId] = useState<
    string | null
  >(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorFollowupForm, setDoctorFollowupForm] =
    useState<DoctorFollowupFormState>(emptyDoctorFollowupForm());
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [prescriptionForm, setPrescriptionForm] =
    useState<PrescriptionFormState>(emptyPrescriptionForm());
  const [labForm, setLabForm] = useState<LabFormState>(emptyLabForm());
  const [labDialogMode, setLabDialogMode] = useState<
    "request" | "result" | null
  >(null);
  const [selectedPendingLabPanelId, setSelectedPendingLabPanelId] = useState<
    string | null
  >(null);
  const [documentForm, setDocumentForm] =
    useState<DocumentFormState>(emptyDocumentForm());
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileKey, setDocumentFileKey] = useState(0);
  const [documentFileDragging, setDocumentFileDragging] = useState(false);
  const [documentOpenPath, setDocumentOpenPath] = useState("");
  const [selectedDicomDocument, setSelectedDicomDocument] =
    useState<MedicalDocument | null>(null);
  const [patientUpdateToast, setPatientUpdateToast] =
    useState<PatientUpdateToast | null>(null);
  const patientCurrentVisitIdRef = useRef<string | null | undefined>(undefined);
  const entranceExamHistoryLengthRef = useRef(0);
  const documentFilterRef = useRef({ patientId, documentFilter });
  const consumedLocationActionRef = useRef<string | null>(null);
  const patientUpdateToastTimeoutRef = useRef<number | undefined>(undefined);
  const handleRealtimeEventRef = useRef<(event: RealtimeEvent) => void>(
    () => undefined,
  );

  useEffect(() => {
    patientCurrentVisitIdRef.current = patient?.currentVisitId;
  }, [patient?.currentVisitId]);

  useEffect(() => {
    entranceExamHistoryLengthRef.current = entranceExamHistory.length;
  }, [entranceExamHistory.length]);

  const entranceExamGateActive =
    Boolean(patient?.currentVisitId) && !hasCurrentEntranceExam;

  const showEntranceExamGateMessage = useCallback(() => {
    setSuccess("");
    setError(
      "Enregistrez l'examen d'entrée de cette visite avant de modifier les données cliniques.",
    );
  }, []);

  const ensureEntranceExamBeforeClinicalData = useCallback(() => {
    if (!entranceExamGateActive) {
      return true;
    }

    showEntranceExamGateMessage();
    navigate(`/patients/${patientId}/entrance`);
    return false;
  }, [
    entranceExamGateActive,
    navigate,
    patientId,
    showEntranceExamGateMessage,
  ]);

  useEffect(() => {
    const state = location.state as PatientWorkspaceLocationState;

    if (
      loading ||
      activeTab !== "labs" ||
      state?.patientWorkspaceAction !== "request-lab"
    ) {
      return;
    }

    const actionId = state.patientWorkspaceActionId ?? location.key;

    if (consumedLocationActionRef.current === actionId) {
      return;
    }

    consumedLocationActionRef.current = actionId;

    const timeout = window.setTimeout(() => {
      if (entranceExamGateActive) {
        showEntranceExamGateMessage();
        navigate(`/patients/${patientId}/entrance`, { replace: true });
        return;
      }

      setLabForm(emptyLabForm());
      setLabDialogMode("request");
      navigate(location.pathname, { replace: true, state: null });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    activeTab,
    entranceExamGateActive,
    loading,
    location.key,
    location.pathname,
    location.state,
    navigate,
    patientId,
    showEntranceExamGateMessage,
  ]);

  useEffect(() => {
    const previousTabIndex = previousTabIndexRef.current;

    if (previousTabIndex !== activeTabIndex) {
      setTabDirection(
        activeTabIndex > previousTabIndex ? "forward" : "backward",
      );
      previousTabIndexRef.current = activeTabIndex;
    }
  }, [activeTabIndex]);

  const applyWorkspaceSnapshot = useCallback(
    (snapshot: PatientWorkspaceSnapshot) => {
      patientCurrentVisitIdRef.current = snapshot.patient.currentVisitId;
      setPatient(snapshot.patient);
      setPatientForm(patientToForm(snapshot.patient));
      setLatestVital(snapshot.latestVital);
      setVitals(snapshot.vitals);
      setPrescriptions(snapshot.prescriptions);
      setLabs(snapshot.labs);
      setDocuments(snapshot.documents);
      setNotes(snapshot.notes);
      setEntranceExamForm(entranceExamToForm(snapshot.entranceExam));
      setHasCurrentEntranceExam(Boolean(snapshot.entranceExam.exam));
    },
    [],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");

    const cachedSnapshot = peekPatientWorkspaceSnapshot(patientId);

    if (cachedSnapshot) {
      applyWorkspaceSnapshot(cachedSnapshot);
      setLoading(false);
    }

    try {
      const snapshot = await getPatientWorkspaceSnapshot(patientId, {
        force: Boolean(cachedSnapshot),
      });

      applyWorkspaceSnapshot(snapshot);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [applyWorkspaceSnapshot, patientId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadWorkspace]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      entranceExamHistoryLengthRef.current = 0;
      setEntranceExamHistory([]);
      setHasMoreEntranceExams(true);
      setLoadingEntranceExamHistory(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [patientId]);

  const refreshPatient = useCallback(async () => {
    try {
      const patientResult = await getPatient(patientId);
      const visitChanged =
        patientCurrentVisitIdRef.current !== patientResult.currentVisitId;

      patientCurrentVisitIdRef.current = patientResult.currentVisitId;
      setPatient(patientResult);
      setPatientForm(patientToForm(patientResult));
      if (visitChanged) {
        const entranceExam = await getEntranceExam(patientId);

        setEntranceExamForm(entranceExamToForm(entranceExam));
        setHasCurrentEntranceExam(Boolean(entranceExam.exam));
        entranceExamHistoryLengthRef.current = 0;
        setEntranceExamHistory([]);
        setHasMoreEntranceExams(true);
      }
      onPatientChanged();
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [onPatientChanged, patientId]);

  const refreshVitals = useCallback(async () => {
    try {
      const vitalResults = await listVitalRecords(patientId);

      setLatestVital(vitalResults[0] ?? null);
      setVitals(vitalResults);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [patientId]);

  const refreshPrescriptions = useCallback(async () => {
    try {
      setPrescriptions(await listPrescriptions(patientId));
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [patientId]);

  const refreshPatientDoctorFollowups = useCallback(async () => {
    try {
      setPatientDoctorFollowups(await listPatientDoctorFollowups(patientId));
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [patientId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshPatientDoctorFollowups();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshPatientDoctorFollowups]);

  useEffect(() => {
    const search = doctorSearch.trim();
    const selectedDoctorName = selectedDoctor
      ? formatDoctorName(selectedDoctor)
      : "";
    let cancelled = false;

    const timeout = window.setTimeout(
      () => {
        if (search.length < 2 || search === selectedDoctorName) {
          setDoctorSearchResults([]);
          setDoctorSearchLoading(false);
          return;
        }

        setDoctorSearchLoading(true);
        searchDoctors(search, { limit: 30 })
          .then((results) => {
            if (!cancelled) {
              setDoctorSearchResults(results);
            }
          })
          .catch((searchError) => {
            if (!cancelled) {
              setError(errorMessage(searchError));
            }
          })
          .finally(() => {
            if (!cancelled) {
              setDoctorSearchLoading(false);
            }
          });
      },
      search.length < 2 || search === selectedDoctorName ? 0 : 220,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [doctorSearch, selectedDoctor]);

  const refreshLabs = useCallback(async () => {
    try {
      setLabs(await listLabResults(patientId));
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [patientId]);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(
        await listMedicalDocuments(
          patientId,
          documentFilter === "all" ? {} : { category: documentFilter },
        ),
      );
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [documentFilter, patientId]);

  useEffect(() => {
    const previousDocumentFilter = documentFilterRef.current;
    const patientChanged = previousDocumentFilter.patientId !== patientId;

    if (
      !patientChanged &&
      previousDocumentFilter.documentFilter === documentFilter
    ) {
      return;
    }

    documentFilterRef.current = { patientId, documentFilter };
    if (patientChanged && documentFilter === "all") {
      return;
    }

    void refreshDocuments();
  }, [documentFilter, patientId, refreshDocuments]);

  const refreshEvolutionNotes = useCallback(async () => {
    try {
      setNotes(await listEvolutionNotes(patientId));
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [patientId]);

  const refreshEntranceExam = useCallback(async () => {
    try {
      const entranceExam = await getEntranceExam(patientId);

      setEntranceExamForm(entranceExamToForm(entranceExam));
      setHasCurrentEntranceExam(Boolean(entranceExam.exam));
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [patientId]);

  const loadEntranceExamHistory = useCallback(
    async (reset = false) => {
      setLoadingEntranceExamHistory(true);
      setError("");

      try {
        const exams = await listEntranceExams(patientId, {
          limit: ENTRANCE_EXAM_HISTORY_PAGE_SIZE,
          offset: reset ? 0 : entranceExamHistoryLengthRef.current,
        });

        setEntranceExamHistory((current) => {
          const nextExams = reset ? exams : [...current, ...exams];
          entranceExamHistoryLengthRef.current = nextExams.length;
          return nextExams;
        });
        setHasMoreEntranceExams(
          exams.length === ENTRANCE_EXAM_HISTORY_PAGE_SIZE,
        );
      } catch (loadError) {
        setError(errorMessage(loadError));
        setHasMoreEntranceExams(false);
      } finally {
        setLoadingEntranceExamHistory(false);
      }
    },
    [patientId],
  );

  useEffect(() => {
    if (
      activeTab !== "entrance" ||
      entranceExamHistory.length > 0 ||
      loadingEntranceExamHistory ||
      !hasMoreEntranceExams
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadEntranceExamHistory(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    activeTab,
    entranceExamHistory.length,
    hasMoreEntranceExams,
    loadEntranceExamHistory,
    loadingEntranceExamHistory,
  ]);

  useEffect(() => {
    if (
      !requiresEntranceExamBeforeClinicalData(activeTab) ||
      !entranceExamGateActive
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      showEntranceExamGateMessage();
      navigate(`/patients/${patientId}/entrance`, { replace: true });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    activeTab,
    entranceExamGateActive,
    navigate,
    patientId,
    showEntranceExamGateMessage,
  ]);

  const showPatientUpdateToast = useCallback((toast: PatientUpdateToast) => {
    if (patientUpdateToastTimeoutRef.current !== undefined) {
      window.clearTimeout(patientUpdateToastTimeoutRef.current);
    }

    setPatientUpdateToast(toast);
    patientUpdateToastTimeoutRef.current = window.setTimeout(() => {
      setPatientUpdateToast(null);
      patientUpdateToastTimeoutRef.current = undefined;
    }, PATIENT_UPDATE_TOAST_DURATION_MS);
  }, []);

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.patientId !== patientId) {
        return;
      }

      invalidatePatientWorkspaceSnapshot(patientId);

      const toast = patientUpdateToastFromRealtimeEvent(event);

      if (toast) {
        showPatientUpdateToast(toast);
      }

      if (event.entity === "patient") {
        void refreshPatient();
      } else if (event.entity === "vitalRecord") {
        void refreshVitals();
      } else if (event.entity === "prescription") {
        void refreshPrescriptions();
      } else if (event.entity === "patientDoctorFollowup") {
        void refreshPatientDoctorFollowups();
      } else if (event.entity === "labPanel") {
        void refreshLabs();
      } else if (event.entity === "medicalDocument") {
        void refreshDocuments();
      } else if (event.entity === "evolutionNote") {
        void refreshEvolutionNotes();
      } else if (event.entity === "entranceExam") {
        void refreshEntranceExam();
        void loadEntranceExamHistory(true);
      }
    },
    [
      patientId,
      refreshDocuments,
      refreshEvolutionNotes,
      refreshEntranceExam,
      loadEntranceExamHistory,
      refreshLabs,
      refreshPatient,
      refreshPatientDoctorFollowups,
      refreshPrescriptions,
      refreshVitals,
      showPatientUpdateToast,
    ],
  );

  useEffect(() => {
    return () => {
      if (patientUpdateToastTimeoutRef.current !== undefined) {
        window.clearTimeout(patientUpdateToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setRealtimeContext({
      patientId,
      page: realtimePageForPatientTab(activeTab),
    });
  }, [activeTab, patientId]);

  useEffect(() => {
    handleRealtimeEventRef.current = handleRealtimeEvent;
  }, [handleRealtimeEvent]);

  useEffect(
    () => subscribeRealtime((event) => handleRealtimeEventRef.current(event)),
    [],
  );

  const vitalChartData = useMemo(
    () => vitalRecordsToChartData(vitals),
    [vitals],
  );

  const vitalChartPanels = useMemo<VitalChartPanel[]>(
    () => buildVitalChartPanels(latestVital, vitalChartData),
    [latestVital, vitalChartData],
  );

  const selectedEvolutionNoteVital = useMemo(() => {
    if (!selectedEvolutionNote) {
      return null;
    }

    return findLastVitalBefore(vitals, selectedEvolutionNote.recordedAt);
  }, [selectedEvolutionNote, vitals]);

  const selectedEvolutionNoteVitalSummaryItems = useMemo(
    () =>
      selectedEvolutionNoteVital
        ? buildVitalSummaryItems(selectedEvolutionNoteVital)
        : [],
    [selectedEvolutionNoteVital],
  );

  const activeEvolutionService =
    patient?.currentService || currentAccount.service || "";
  const effectiveEvolutionServiceFilter =
    evolutionServiceFilter === EVOLUTION_ACTIVE_SERVICE_FILTER
      ? activeEvolutionService || "all"
      : evolutionServiceFilter;

  const evolutionServiceOptions = useMemo(() => {
    const serviceNames = new Set<string>();
    const addServiceName = (serviceName?: string | null) => {
      const trimmedServiceName = serviceName?.trim();

      if (trimmedServiceName) {
        serviceNames.add(trimmedServiceName);
      }
    };

    addServiceName(patient?.currentService);
    addServiceName(currentAccount.service);
    addServiceName(
      evolutionServiceFilter === "all" ||
        evolutionServiceFilter === EVOLUTION_ACTIVE_SERVICE_FILTER
        ? null
        : evolutionServiceFilter,
    );
    services.forEach((service) => addServiceName(service.name));
    notes.forEach((note) => addServiceName(note.service));

    return [...serviceNames].sort((left, right) => left.localeCompare(right));
  }, [
    currentAccount.service,
    evolutionServiceFilter,
    notes,
    patient?.currentService,
    services,
  ]);

  const searchedEvolutionNotes = useMemo(
    () => notes.filter((note) => textIncludes(note.content, evolutionSearch)),
    [evolutionSearch, notes],
  );

  const serviceFilteredEvolutionNotes = useMemo(
    () =>
      searchedEvolutionNotes.filter(
        (note) =>
          effectiveEvolutionServiceFilter === "all" ||
          note.service === effectiveEvolutionServiceFilter,
      ),
    [effectiveEvolutionServiceFilter, searchedEvolutionNotes],
  );

  const doctorEvolutionNoteCount = useMemo(
    () =>
      serviceFilteredEvolutionNotes.filter(
        (note) => note.authorRole === "doctor",
      ).length,
    [serviceFilteredEvolutionNotes],
  );

  const nurseEvolutionNoteCount = useMemo(
    () =>
      serviceFilteredEvolutionNotes.filter(
        (note) => note.authorRole === "nurse",
      ).length,
    [serviceFilteredEvolutionNotes],
  );

  const otherEvolutionNoteCount = useMemo(
    () =>
      serviceFilteredEvolutionNotes.filter(
        (note) => evolutionNoteRoleFilterFromRole(note.authorRole) === "other",
      ).length,
    [serviceFilteredEvolutionNotes],
  );

  const visibleEvolutionNotes = useMemo(
    () =>
      serviceFilteredEvolutionNotes.filter(
        (note) =>
          evolutionNoteRoleFilterFromRole(note.authorRole) ===
          evolutionNoteRoleFilter,
      ),
    [evolutionNoteRoleFilter, serviceFilteredEvolutionNotes],
  );

  const assignablePlacementBeds = useMemo(() => {
    if (!patient) {
      return [];
    }

    return beds
      .filter((bed) => {
        const isInScope =
          currentAccount.role === "admin" ||
          bed.service === patient.currentService;
        const isAvailable =
          !bed.occupiedPatientId || bed.occupiedPatientId === patient.id;

        return isInScope && isAvailable;
      })
      .sort(
        (left, right) =>
          left.service.localeCompare(right.service) ||
          left.sortOrder - right.sortOrder ||
          left.label.localeCompare(right.label),
      );
  }, [beds, currentAccount.role, patient]);

  const activeLabPanelFilters = labPanelFilters[activeLabPanelTab];
  const pendingLabRequestCount = useMemo(
    () => labs.filter((panel) => panel.status === "en attente").length,
    [labs],
  );
  const completedLabPanelCount = useMemo(
    () => labs.filter((panel) => panel.status !== "en attente").length,
    [labs],
  );
  const pendingLabRequests = useMemo(
    () =>
      labs
        .filter((panel) => panel.status === "en attente")
        .filter((panel) =>
          labPanelMatchesFilters(panel, labPanelFilters.requests),
        ),
    [labPanelFilters.requests, labs],
  );
  const completedLabPanels = useMemo(
    () =>
      labs
        .filter((panel) => panel.status !== "en attente")
        .filter((panel) =>
          labPanelMatchesFilters(panel, labPanelFilters.completed),
        ),
    [labPanelFilters.completed, labs],
  );
  const pendingLabPanelForFormType = useMemo(
    () => findPendingLabPanelForType(labs, labForm.panelType),
    [labForm.panelType, labs],
  );
  const selectedPendingLabPanel = useMemo(
    () =>
      selectedPendingLabPanelId
        ? (labs.find((panel) => panel.id === selectedPendingLabPanelId) ?? null)
        : null,
    [labs, selectedPendingLabPanelId],
  );
  const filteredPrescriptions = useMemo(
    () =>
      prescriptions.filter((prescription) => {
        if (
          !textIncludes(prescription.medication, prescriptionFilters.medication)
        ) {
          return false;
        }

        const prescriptionStartDate = dateInput(prescription.startDate);

        if (
          prescriptionFilters.startDateFrom &&
          prescriptionStartDate < prescriptionFilters.startDateFrom
        ) {
          return false;
        }

        if (
          prescriptionFilters.startDateTo &&
          prescriptionStartDate > prescriptionFilters.startDateTo
        ) {
          return false;
        }

        return true;
      }),
    [prescriptionFilters, prescriptions],
  );

  const imagingDocuments = useMemo(
    () => documents.filter((document) => document.category === "imaging"),
    [documents],
  );

  const visibleDocuments = useMemo(
    () =>
      documents.filter((document) =>
        textIncludes(document.note ?? "", documentNoteSearch),
      ),
    [documentNoteSearch, documents],
  );

  const assignedDoctorSpecialties = useMemo(
    () =>
      Array.from(
        new Set(
          patientDoctorFollowups
            .map((followup) => followup.specialty.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, "fr")),
    [patientDoctorFollowups],
  );

  const effectiveDoctorSpecialtyFilter =
    doctorSpecialtyFilter === "all" ||
    assignedDoctorSpecialties.includes(doctorSpecialtyFilter)
      ? doctorSpecialtyFilter
      : "all";

  const filteredPatientDoctorFollowups = useMemo(
    () =>
      effectiveDoctorSpecialtyFilter === "all"
        ? patientDoctorFollowups
        : patientDoctorFollowups.filter(
            (followup) => followup.specialty === effectiveDoctorSpecialtyFilter,
          ),
    [effectiveDoctorSpecialtyFilter, patientDoctorFollowups],
  );

  const selectedDoctorSpecialties = useMemo(() => {
    const values = selectedDoctor ? doctorSpecialtyOptions(selectedDoctor) : [];

    if (
      values.length !== 1 &&
      doctorFollowupForm.specialty &&
      !values.includes(doctorFollowupForm.specialty)
    ) {
      values.unshift(doctorFollowupForm.specialty);
    }

    return values;
  }, [doctorFollowupForm.specialty, selectedDoctor]);

  const hasPrescriptionFilters = useMemo(
    () =>
      Object.values(prescriptionFilters).some(
        (filterValue) => filterValue.trim() !== "",
      ),
    [prescriptionFilters],
  );
  const editingVitalRecord = useMemo(
    () =>
      editingVitalId
        ? (vitals.find((record) => record.id === editingVitalId) ?? null)
        : null,
    [editingVitalId, vitals],
  );
  const editingVitalExpired =
    editingVitalRecord !== null &&
    !isVitalRecordEditable(editingVitalRecord, vitalEditNow);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVitalEditNow(Date.now());
    }, VITAL_RECORD_EDIT_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  async function runAction(action: () => Promise<void>, okMessage: string) {
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(okMessage);
    } catch (actionError) {
      setError(errorMessage(actionError));
    }
  }

  async function handleUpdatePatient() {
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
        administrativeInfo: richTextNullableOptionalValue(
          patientForm.administrativeInfo,
        ),
        contactPersons: patientContactPersonsFormToInput(
          patientForm.contactPersons,
        ),
        bedId: nullableOptionalValue(patientForm.bedId),
      });
      patientCurrentVisitIdRef.current = updated.currentVisitId;
      setPatient(updated);
      setPatientForm(patientToForm(updated));
      invalidatePatientWorkspaceSnapshot(patientId);
      onPatientChanged();
    }, "Dossier patient enregistré");
  }

  function handleOpenPlacementDialog() {
    setPlacementBedId(patient?.bedId ?? "");
    setPlacementDialogOpen(true);
  }

  function handlePlacementDialogOpenChange(open: boolean) {
    if (open) {
      setPlacementBedId(patient?.bedId ?? "");
    }

    setPlacementDialogOpen(open);
  }

  async function handleAssignBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBedId = nullableOptionalValue(placementBedId);
    const nextBed =
      nextBedId == null ? null : beds.find((bed) => bed.id === nextBedId);

    await runAction(
      async () => {
        const updated = await updatePatient(patientId, {
          bedId: nextBedId,
        });

        patientCurrentVisitIdRef.current = updated.currentVisitId;
        setPatient(updated);
        setPatientForm(patientToForm(updated));
        setPlacementDialogOpen(false);
        invalidatePatientWorkspaceSnapshot(patientId);
        onPatientChanged();
      },
      nextBed ? `Patient place en ${bedLabelText(nextBed)}` : "Lit libere",
    );
  }

  async function handleEndVisit() {
    await runAction(async () => {
      const updated = await endPatientVisit(patientId);
      patientCurrentVisitIdRef.current = updated.currentVisitId;
      setPatient(updated);
      setPatientForm(patientToForm(updated));
      setPlacementBedId("");
      setPlacementDialogOpen(false);
      setEndVisitDialogOpen(false);
      invalidatePatientWorkspaceSnapshot(patientId);
      onPatientChanged();
    }, "Visite terminee");
  }

  async function handleStartNewVisit() {
    await runAction(async () => {
      const updated = await startNewPatientVisit(patientId);
      const entranceExam = await getEntranceExam(patientId);

      setPatient(updated);
      patientCurrentVisitIdRef.current = updated.currentVisitId;
      setPatientForm(patientToForm(updated));
      setEntranceExamForm(entranceExamToForm(entranceExam));
      setHasCurrentEntranceExam(Boolean(entranceExam.exam));
      entranceExamHistoryLengthRef.current = 0;
      setEntranceExamHistory([]);
      setHasMoreEntranceExams(true);
      setNewVisitDialogOpen(false);
      invalidatePatientWorkspaceSnapshot(patientId);
      onPatientChanged();
      navigate(`/patients/${patientId}/entrance`);
    }, "Nouvelle visite créée");
  }

  async function handlePrepareEntranceExam() {
    await runAction(async () => {
      const updated = await startNewPatientVisit(patientId);
      const entranceExam = await getEntranceExam(patientId);

      setPatient(updated);
      patientCurrentVisitIdRef.current = updated.currentVisitId;
      setPatientForm(patientToForm(updated));
      setEntranceExamForm(entranceExamToForm(entranceExam));
      setHasCurrentEntranceExam(Boolean(entranceExam.exam));
      entranceExamHistoryLengthRef.current = 0;
      setEntranceExamHistory([]);
      setHasMoreEntranceExams(true);
      invalidatePatientWorkspaceSnapshot(patientId);
      onPatientChanged();
      navigate(`/patients/${patientId}/entrance`);
    }, "Bilan d'entrée prêt");
  }

  async function handleSaveEntranceExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      const saved = await saveEntranceExam(
        patientId,
        entranceExamFormToInput(entranceExamForm),
      );

      setEntranceExamForm(entranceExamToForm(saved));
      setHasCurrentEntranceExam(Boolean(saved.exam));
      invalidatePatientWorkspaceSnapshot(patientId);
      await loadEntranceExamHistory(true);
    }, "Examen d'entrée enregistré");
  }

  async function handleSubmitVital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }
    if (
      editingVitalRecord !== null &&
      !isVitalRecordEditable(editingVitalRecord)
    ) {
      setSuccess("");
      setError(VITAL_RECORD_EDIT_EXPIRED_MESSAGE);
      return;
    }

    await runAction(
      async () => {
        if (editingVitalId) {
          await updateVitalRecord(
            patientId,
            editingVitalId,
            vitalFormToInput(vitalForm),
          );
        } else {
          await addVitalRecord(
            patientId,
            vitalFormToInput(vitalForm, nowLocalInput()),
          );
        }

        setEditingVitalId(null);
        setVitalDialogOpen(false);
        setVitalForm(emptyVitalForm());
        invalidatePatientWorkspaceSnapshot(patientId);
        await refreshVitals();
      },
      editingVitalId ? "Constantes modifiees" : "Constantes ajoutees",
    );
  }

  function handleOpenNewVitalDialog() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setEditingVitalId(null);
    setVitalForm(emptyVitalForm());
    setVitalDialogOpen(true);
  }

  function handleEditVital(record: VitalRecord) {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }
    if (!isVitalRecordEditable(record)) {
      setSuccess("");
      setError(VITAL_RECORD_EDIT_EXPIRED_MESSAGE);
      return;
    }

    if (editingVitalId !== record.id) {
      setEditingVitalId(record.id);
      setVitalForm(vitalRecordToForm(record));
    }

    setVitalDialogOpen(true);
  }

  function handleCancelVitalEdit() {
    setVitalDialogOpen(false);
  }

  async function handleDeleteVital(record: VitalRecord) {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer la mesure du ${formatShortDateTime(record.recordedAt)} ?`,
    );

    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await deleteVitalRecord(patientId, record.id);

      if (editingVitalId === record.id) {
        setEditingVitalId(null);
        setVitalDialogOpen(false);
        setVitalForm(emptyVitalForm());
      }

      invalidatePatientWorkspaceSnapshot(patientId);
      await refreshVitals();
    }, "Mesure supprimée");
  }

  function handleOpenDoctorDialog() {
    setEditingDoctorFollowupId(null);
    setSelectedDoctor(null);
    setDoctorSearch("");
    setDoctorSearchResults([]);
    setDoctorFollowupForm(emptyDoctorFollowupForm());
    setDoctorDialogOpen(true);
  }

  function handleSelectDoctor(doctor: Doctor) {
    const specialties = doctorSpecialtyOptions(doctor);
    const defaultSpecialty = specialties[0] ?? "";

    setSelectedDoctor(doctor);
    setDoctorSearch(formatDoctorName(doctor));
    setDoctorSearchResults([]);
    setDoctorSearchLoading(false);
    setDoctorFollowupForm((current) => ({
      ...current,
      doctorId: doctor.id,
      specialty:
        specialties.length === 1 || !specialties.includes(current.specialty)
          ? defaultSpecialty
          : current.specialty,
    }));
  }

  function handleEditPatientDoctorFollowup(followup: PatientDoctorFollowup) {
    const doctor = doctorFromFollowup(followup);
    const specialties = doctorSpecialtyOptions(doctor);

    setEditingDoctorFollowupId(followup.id);
    setSelectedDoctor(doctor);
    setDoctorSearch(formatDoctorName(doctor));
    setDoctorSearchResults([]);
    setDoctorFollowupForm({
      doctorId: followup.doctorId,
      specialty:
        specialties.length === 1
          ? (specialties[0] ?? followup.specialty)
          : followup.specialty,
      startDate: dateInput(followup.startDate),
      endDate: dateInput(followup.endDate ?? ""),
    });
    setDoctorDialogOpen(true);
  }

  async function handleSavePatientDoctorFollowup(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await runAction(
      async () => {
        const input = {
          doctorId: doctorFollowupForm.doctorId,
          specialty: doctorFollowupForm.specialty,
          startDate: doctorFollowupForm.startDate,
          endDate: nullableOptionalValue(doctorFollowupForm.endDate),
        };

        if (editingDoctorFollowupId) {
          await updatePatientDoctorFollowup(
            patientId,
            editingDoctorFollowupId,
            input,
          );
        } else {
          await addPatientDoctorFollowup(patientId, input);
        }

        setEditingDoctorFollowupId(null);
        setSelectedDoctor(null);
        setDoctorSearch("");
        setDoctorSearchResults([]);
        setDoctorFollowupForm(emptyDoctorFollowupForm());
        setDoctorDialogOpen(false);
        await refreshPatientDoctorFollowups();
      },
      editingDoctorFollowupId ? "Suivi medecin modifie" : "Medecin assigne",
    );
  }

  async function handleDeletePatientDoctorFollowup(
    followup: PatientDoctorFollowup,
  ) {
    const confirmed = window.confirm(
      `Supprimer le suivi ${followup.specialty} avec ${formatDoctorNameFromFollowup(
        followup,
      )} ?`,
    );

    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await deletePatientDoctorFollowup(patientId, followup.id);

      if (editingDoctorFollowupId === followup.id) {
        setEditingDoctorFollowupId(null);
        setDoctorDialogOpen(false);
        setDoctorFollowupForm(emptyDoctorFollowupForm());
      }

      await refreshPatientDoctorFollowups();
    }, "Suivi medecin supprime");
  }

  async function handleAddPrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    await runAction(
      async () => {
        const medicationInputs = prescriptionForm.medications.map(
          trimPrescriptionMedicationForm,
        );

        if (medicationInputs.some((medication) => !medication.medicineId)) {
          throw new Error(
            "Sélectionnez un médicament référence pour chaque ligne",
          );
        }

        await Promise.all(
          medicationInputs.map((medication) => {
            const prescriptionEndDate = prescriptionEndDateFromDuration(
              prescriptionForm.startDate,
              medication.durationValue,
              medication.durationUnit,
            );

            return addPrescription(patientId, {
              medicineId: medication.medicineId,
              dosage: medication.dosage,
              frequency: medication.frequency,
              route: medication.route,
              startDate: prescriptionForm.startDate,
              endDate: prescriptionEndDate,
              status: prescriptionForm.status,
            });
          }),
        );

        setPrescriptionForm(emptyPrescriptionForm());
        setPrescriptionDialogOpen(false);
        invalidatePatientWorkspaceSnapshot(patientId);
        await refreshPrescriptions();
      },
      prescriptionForm.medications.length > 1
        ? "Prescriptions ajoutees"
        : "Prescription ajoutee",
    );
  }

  function handleOpenPrescriptionDialog() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setPrescriptionForm(emptyPrescriptionForm());
    setPrescriptionDialogOpen(true);
  }

  async function handlePrescriptionStatus(
    prescriptionId: string,
    status: string,
  ) {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    await runAction(async () => {
      await updatePrescriptionStatus(prescriptionId, status);
      invalidatePatientWorkspaceSnapshot(patientId);
      await refreshPrescriptions();
    }, "Statut modifie");
  }

  async function handleSubmitLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    await runAction(async () => {
      const results = labFormResultsToInput(labForm);

      if (labDialogMode === "request") {
        await addLabResult(patientId, {
          sampledAt: labForm.sampledAt,
          panelType: labForm.panelType,
          note: labForm.note,
          status: "en attente",
          results: [],
        });
        setLabForm(emptyLabForm());
        setLabDialogMode(null);
        setSelectedPendingLabPanelId(null);
        invalidatePatientWorkspaceSnapshot(patientId);
        await refreshLabs();
        return;
      }

      if (results.length === 0) {
        throw new Error("Renseignez au moins une valeur biologique");
      }

      const pendingPanel =
        selectedPendingLabPanel ??
        findPendingLabPanelForType(labs, labForm.panelType);

      if (pendingPanel) {
        await updateLabResult(patientId, pendingPanel.id, {
          sampledAt: labForm.sampledAt,
          results,
        });
      } else {
        await addLabResult(patientId, {
          sampledAt: labForm.sampledAt,
          panelType: labForm.panelType,
          status: worstLabStatus(results.map((result) => result.status)),
          results,
        });
      }

      setLabForm(emptyLabForm());
      setLabDialogMode(null);
      setSelectedPendingLabPanelId(null);
      invalidatePatientWorkspaceSnapshot(patientId);
      await refreshLabs();
    }, labDialogMode === "request" ? "Demande de bilan ajoutee" : "Bilan biologique enregistre");
  }

  function handleOpenLabRequestDialog() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setLabForm(emptyLabForm());
    setSelectedPendingLabPanelId(null);
    setLabDialogMode("request");
  }

  function handleOpenLabResultDialog() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setLabForm(emptyLabForm());
    setSelectedPendingLabPanelId(null);
    setLabDialogMode("result");
  }

  function handleOpenPendingLabResultDialog(panel: LabPanel) {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setLabForm(
      emptyLabForm(
        panel.panelType as LabPanelType,
        panel.sampledAt,
        panel.note,
      ),
    );
    setSelectedPendingLabPanelId(panel.id);
    setLabDialogMode("result");
  }

  function updateActiveLabPanelFilters(
    update: (filters: LabPanelFilters) => LabPanelFilters,
  ) {
    setLabPanelFilters((current) => ({
      ...current,
      [activeLabPanelTab]: update(current[activeLabPanelTab]),
    }));
  }

  function handleLabPanelFilterChange(value: string) {
    updateActiveLabPanelFilters((filters) => ({
      ...filters,
      panelType: value as LabPanelType | "all",
      markerFilters: {},
    }));
  }

  function handleLabStatusFilterChange(value: string) {
    updateActiveLabPanelFilters((filters) => ({
      ...filters,
      status: value as LabStatus | "all",
    }));
  }

  function updateLabMarkerFilter(
    markerKey: string,
    patch: Partial<LabMarkerRangeFilter>,
  ) {
    updateActiveLabPanelFilters((filters) => ({
      ...filters,
      markerFilters: {
        ...filters.markerFilters,
        [markerKey]: {
          ...emptyLabMarkerRangeFilter(),
          ...filters.markerFilters[markerKey],
          ...patch,
        },
      },
    }));
  }

  function clearLabMarkerFilter(markerKey: string) {
    updateActiveLabPanelFilters((filters) => {
      const remainingFilters = { ...filters.markerFilters };
      delete remainingFilters[markerKey];
      return {
        ...filters,
        markerFilters: remainingFilters,
      };
    });
  }

  async function handleAddDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    await runAction(async () => {
      const filePayload = documentFile
        ? {
            contentBase64: await readFileAsDataUrl(documentFile),
            originalFileName: documentFile.name,
            mimeType: documentFile.type || "application/octet-stream",
          }
        : {};

      await addMedicalDocument(patientId, {
        title: documentForm.title,
        category: documentForm.category,
        note: richTextOptionalValue(documentForm.note),
        storagePath: optionalValue(documentForm.storagePath),
        ...filePayload,
      });
      setDocumentForm(emptyDocumentForm());
      setDocumentFile(null);
      setDocumentFileKey((current) => current + 1);
      setDocumentDialogOpen(false);
      invalidatePatientWorkspaceSnapshot(patientId);
      await refreshDocuments();
    }, "Document ajoute");
  }

  function handleOpenDocumentDialog() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setDocumentForm(emptyDocumentForm());
    setDocumentFile(null);
    setDocumentFileDragging(false);
    setDocumentFileKey((current) => current + 1);
    setDocumentDialogOpen(true);
  }

  function handleDocumentDialogOpenChange(open: boolean) {
    if (!open) {
      setDocumentFileDragging(false);
    }

    setDocumentDialogOpen(open);
  }

  function hasDraggedFiles(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDocumentFileDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (hasDraggedFiles(event)) {
      setDocumentFileDragging(true);
    }
  }

  function handleDocumentFileDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (hasDraggedFiles(event)) {
      event.dataTransfer.dropEffect = "copy";
      setDocumentFileDragging(true);
    }
  }

  function handleDocumentFileDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDocumentFileDragging(false);
  }

  function handleDocumentFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDocumentFileDragging(false);

    const file = event.dataTransfer.files[0];

    if (!file) {
      return;
    }

    setDocumentFile(file);
    setDocumentFileKey((current) => current + 1);
  }

  async function handleOpenDocument(documentId: string) {
    await runAction(async () => {
      const result = await openMedicalDocument(documentId);
      setDocumentOpenPath(result.storagePath ?? "Aucun chemin de stockage");
    }, "Référence document chargée");
  }

  async function handleDownloadDocument(document: MedicalDocument) {
    await runAction(async () => {
      const response = await downloadMedicalDocument(document.id);

      if (!response.ok) {
        throw new Error(`Téléchargement refusé (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ||
        document.originalFileName ||
        `${document.title}.bin`;
      anchor.click();
      URL.revokeObjectURL(url);
    }, "Téléchargement lancé");
  }

  function handleViewDicomDocument(document: MedicalDocument) {
    if (!canOpenDicomViewer(document)) {
      setSuccess("");
      setError(
        "La vue Cornerstone est disponible uniquement pour les fichiers DICOM d'imagerie.",
      );
      return;
    }

    setError("");
    setSelectedDicomDocument(document);
  }

  function handleOpenNewEvolutionNoteEditor() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    openRichTextDialog({
      ariaLabel: "Contenu de la note d'évolution",
      dialogDescription: "Saisissez uniquement le contenu clinique de la note.",
      placeholder: "Contenu de la note",
      required: true,
      title: "Nouvelle note d'évolution",
      value: "",
      onChange: handleCreateEvolutionNote,
    });
  }

  async function handleCreateEvolutionNote(value: string) {
    const content = richTextOptionalValue(value);

    if (!content) {
      throw new Error("Renseignez le contenu de la note d'évolution");
    }

    setError("");
    setSuccess("");

    try {
      const createdNote = await addEvolutionNote(patientId, {
        service: patient?.currentService ?? currentAccount.service,
        visitId: patient?.currentVisitId ?? defaultVisitId(),
        author: currentAccount.name,
        recordedAt: nowLocalInput(),
        content,
      });
      invalidatePatientWorkspaceSnapshot(patientId);
      await refreshEvolutionNotes();
      setEvolutionSearch("");
      setEvolutionServiceFilter(EVOLUTION_ACTIVE_SERVICE_FILTER);
      setEvolutionNoteRoleFilter(
        evolutionNoteRoleFilterFromRole(createdNote.authorRole),
      );
      setSuccess("Note d'evolution ajoutee");
    } catch (actionError) {
      const message = errorMessage(actionError);
      setError(message);
      throw new Error(message, { cause: actionError });
    }
  }

  function handleTabChange(value: string) {
    const nextTab = value as PatientTab;

    if (nextTab === activeTab) {
      return;
    }

    if (
      requiresEntranceExamBeforeClinicalData(nextTab) &&
      entranceExamGateActive
    ) {
      showEntranceExamGateMessage();
      navigate(`/patients/${patientId}/entrance`);
      return;
    }

    const nextTabIndex = PATIENT_TAB_VALUES.indexOf(nextTab);
    const direction = nextTabIndex > activeTabIndex ? "forward" : "backward";
    setTabDirection(direction);
    navigate(`/patients/${patientId}/${nextTab}`);
  }

  if (!tab || !activeTabFromRoute) {
    return <Navigate to={`/patients/${patientId}/summary`} replace />;
  }

  if (loading && !patient) {
    return <LoadingScreen label="Chargement du dossier patient" />;
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        {error && <AlertMessage message={error} />}
        <EmptyState label="Dossier patient introuvable" />
      </div>
    );
  }

  const hasActiveVisit = Boolean(patient.currentVisitId);
  const entranceExamLocked = entranceExamGateActive;
  const entranceExamReadOnly =
    hasActiveVisit &&
    currentAccount.role !== "admin" &&
    patient.currentService !== currentAccount.service;
  const entranceExamReadOnlyDescription = entranceExamReadOnly
    ? `Ce patient est actuellement dans le service ${patient.currentService}. Vous consultez le bilan d'entrée actuel en lecture seule ; seul le service ${patient.currentService} peut le modifier.`
    : undefined;
  const patientAgeLabel = formatPatientAge(patient.birthDate);
  const patientRoomBedLabel = formatPatientRoomBed(beds, patient.bedId);
  const placementButtonLabel = patient.bedId
    ? "Changer de chambre"
    : "Ajouter a une chambre";
  const latestVitalSummaryItems = latestVital
    ? buildVitalSummaryItems(latestVital)
    : [];
  return (
    <div className="space-y-5 min-hh-full">
      <AnimatePresence>
        {patientUpdateToast && (
          <motion.div
            key={patientUpdateToast.id}
            aria-live="polite"
            className="fixed top-4 left-1/2 z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 min-h-full"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-background/95 px-4 py-3 text-sm shadow-lg shadow-foreground/10 backdrop-blur">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BellRing className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">Dossier patient mis à jour</p>
                <p className="mt-0.5 break-words text-muted-foreground">
                  {patientUpdateToast.detail}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedDicomDocument && (
        <Suspense fallback={null}>
          <DicomImageViewerDialog
            document={selectedDicomDocument}
            open
            onOpenChange={(open) => {
              if (!open) {
                setSelectedDicomDocument(null);
              }
            }}
          />
        </Suspense>
      )}

      <Dialog
        open={placementDialogOpen}
        onOpenChange={handlePlacementDialogOpenChange}
      >
        <DialogContent className="sm:max-w-2xl">
          <form className="grid gap-4" onSubmit={handleAssignBed}>
            <DialogHeader>
              <DialogTitle>{placementButtonLabel}</DialogTitle>
              <DialogDescription>
                {patient.lastName} {patient.firstName}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Lit actuel</p>
                <p className="mt-1 font-medium">
                  {bedLabel(beds, patient.bedId)}
                </p>
              </div>

              <ScrollArea className="max-h-[50vh] rounded-3xl border bg-background">
                {assignablePlacementBeds.length > 0 ? (
                  <div className="divide-y">
                    {assignablePlacementBeds.map((bed) => {
                      const selected = placementBedId === bed.id;
                      const isCurrentBed = bed.occupiedPatientId === patient.id;

                      return (
                        <button
                          key={bed.id}
                          type="button"
                          aria-pressed={selected}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            selected && "bg-primary/10 text-primary",
                          )}
                          onClick={() => setPlacementBedId(bed.id)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              Chambre {bed.label}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {bed.service}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-md border px-2 py-1 text-xs",
                              selected
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {isCurrentBed ? "Lit actuel" : "Disponible"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4">
                    <EmptyState label="Aucun lit disponible" />
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={!patient.bedId && !placementBedId}
                onClick={() => setPlacementBedId("")}
              >
                <BedIcon className="size-4" />
                Liberer le lit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlacementDialogOpen(false)}
              >
                <XCircle className="size-4" />
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={placementBedId === (patient.bedId ?? "")}
              >
                <Save className="size-4" />
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={endVisitDialogOpen} onOpenChange={setEndVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fin de visite</DialogTitle>
            <DialogDescription>
              Confirmez que {patient.lastName} {patient.firstName} repart chez
              lui. La chambre sera liberee.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEndVisitDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleEndVisit()}
            >
              Confirmer la fin de visite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newVisitDialogOpen} onOpenChange={setNewVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle visite</DialogTitle>
            <DialogDescription>
              Confirmez la creation d'une nouvelle visite pour{" "}
              {patient.lastName} {patient.firstName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewVisitDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" onClick={() => void handleStartNewVisit()}>
              Nouvelle visite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        orientation="vertical"
        className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start"
      >
        <aside className="grid gap-3 lg:sticky lg:top-4">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate("/patients")}
          >
            <ArrowLeft className="size-4" />
            Retour
          </Button>

          <div className="grid gap-3 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-start gap-2">
                <h2 className="min-w-0 flex-1 break-words font-heading text-xl font-medium leading-tight">
                  {patient.lastName} {patient.firstName}
                </h2>
                <PatientSexIcon sex={patient.sex} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {patient.currentService}
              </p>
            </div>

            <div className="grid gap-1.5">
              <div className="flex gap-1.5">
                <div className="min-w-0 flex-1">
                  <PatientInfoBadge className="w-full min-w-0 truncate whitespace-nowrap">
                    {`Age: ${patientAgeLabel}`}
                  </PatientInfoBadge>
                </div>
                <div className="min-w-0 flex-1">
                  <PatientInfoBadge className="w-full min-w-0 truncate whitespace-nowrap">
                    {`IPP: ${patient.id}`}
                  </PatientInfoBadge>
                </div>
              </div>
              <PatientInfoBadge className="w-full min-w-0 truncate whitespace-nowrap">
                {`Chambre / lit: ${patientRoomBedLabel}`}
              </PatientInfoBadge>
            </div>
          </div>

          <TabsList className="flex !h-auto w-full flex-col items-stretch justify-start gap-1 rounded-lg border border-border/70 bg-card p-1.5">
            {PATIENT_TABS.map((tab) => {
              const locked =
                entranceExamLocked &&
                requiresEntranceExamBeforeClinicalData(tab.value);

              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  aria-disabled={locked}
                  className={cn(
                    "flex h-9 w-full justify-start rounded-md px-2 shadow-none group-data-[variant=default]/tabs-list:data-active:shadow-none",
                    locked && "opacity-50",
                  )}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="rounded-lg border border-border bg-card p-3">
            {latestVital ? (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Constantes - {formatShortDateTime(latestVital.recordedAt)}
                </p>
                <div className="grid w-full grid-cols-2 gap-1.5">
                  {latestVitalSummaryItems.map((item) => (
                    <PatientInfoBadge
                      key={item.label}
                      className={cn(
                        "w-full min-w-0 font-normal",
                        vitalStatusClass(item.statusSeverity),
                        item.spanTwoColumns && "col-span-2",
                      )}
                    >
                      <span
                        className="flex w-full min-w-0 items-baseline gap-2 whitespace-nowrap"
                        title={item.statusLabel}
                        aria-label={
                          item.statusLabel
                            ? `${item.label} ${item.value}. ${item.statusLabel}`
                            : undefined
                        }
                      >
                        <span className="shrink-0 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="min-w-0 truncate font-semibold text-foreground">
                          {item.value}
                        </span>
                      </span>
                    </PatientInfoBadge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                Aucune constante
              </p>
            )}
          </div>

          <div className="grid gap-2">
            {hasActiveVisit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={Boolean(patient.archivedAt)}
                onClick={handleOpenPlacementDialog}
              >
                <ArrowRightLeft className="size-4" />
                {placementButtonLabel}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={Boolean(patient.archivedAt)}
                onClick={() => {
                  setNewVisitDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Nouvelle visite
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full justify-start"
              disabled={!hasActiveVisit}
              onClick={() => setEndVisitDialogOpen(true)}
            >
              <LogOutIcon className="size-4" />
              Fin de visite
            </Button>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {error && <AlertMessage message={error} />}
          {success && <AlertMessage tone="success" message={success} />}
          {documentOpenPath && (
            <AlertMessage
              tone="success"
              message={`Référence: ${documentOpenPath}`}
            />
          )}

          <div className="grid size-full min-h-full overflow-hidden pb-2">
            <AnimatePresence initial={false} custom={tabDirection} mode="sync">
              {activeTab === "summary" && (
                <PatientTabMotion key="summary" direction={tabDirection}>
                  <section className="grid gap-4">
                    <form
                      className="grid gap-4 rounded-lg border border-border bg-card p-3"
                      noValidate
                      onSubmit={(event) => {
                        void patientDetailsForm.handleSubmit(() =>
                          handleUpdatePatient(),
                        )(event);
                      }}
                    >
                      <SectionTitle
                        icon={Stethoscope}
                        title="Synthèse administrative"
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
                        control={patientDetailsForm.control}
                        currentPatientId={patient.id}
                        errors={patientDetailsForm.formState.errors}
                        form={patientForm}
                        showBedField={false}
                        showServiceField={false}
                        services={services}
                        onChange={setPatientForm}
                      />
                    </form>
                  </section>
                </PatientTabMotion>
              )}

              {activeTab === "entrance" && (
                <PatientTabMotion key="entrance" direction={tabDirection}>
                  <EntranceExamPanel
                    exams={entranceExamHistory}
                    form={entranceExamForm}
                    hasMoreExams={hasMoreEntranceExams}
                    hasCurrentExam={hasCurrentEntranceExam}
                    loadingExams={loadingEntranceExamHistory}
                    patientHasActiveVisit={hasActiveVisit}
                    currentVisitId={patient.currentVisitId}
                    imagingDocuments={imagingDocuments}
                    readOnly={entranceExamReadOnly}
                    readOnlyDescription={entranceExamReadOnlyDescription}
                    onChange={setEntranceExamForm}
                    onPrepareEntranceExam={
                      entranceExamReadOnly
                        ? () => void handlePrepareEntranceExam()
                        : undefined
                    }
                    onViewImagingDocument={handleViewDicomDocument}
                    onLoadMore={() => void loadEntranceExamHistory()}
                    onSubmit={handleSaveEntranceExam}
                  />
                </PatientTabMotion>
              )}

              {activeTab === "doctors" && (
                <PatientTabMotion key="doctors" direction={tabDirection}>
                  <section className="grid gap-4">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
                      <SectionTitle
                        icon={Stethoscope}
                        title="Médecins"
                        action={
                          <Button
                            type="button"
                            onClick={handleOpenDoctorDialog}
                          >
                            <Plus className="size-4" />
                            Assigner un médecin
                          </Button>
                        }
                      />

                      <div className="grid gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <ListFilter className="size-3.5" />
                          Filtres
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <Field label="Spécialité">
                            <Select
                              value={effectiveDoctorSpecialtyFilter}
                              onValueChange={setDoctorSpecialtyFilter}
                            >
                              <SelectTrigger className="w-64 max-w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  Toutes les spécialités
                                </SelectItem>
                                {assignedDoctorSpecialties.map((specialty) => (
                                  <SelectItem key={specialty} value={specialty}>
                                    {specialty}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={effectiveDoctorSpecialtyFilter === "all"}
                            onClick={() => setDoctorSpecialtyFilter("all")}
                          >
                            <XCircle className="size-4" />
                            Effacer
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Médecin</TableHead>
                              <TableHead>Spécialité suivie</TableHead>
                              <TableHead>Suivi</TableHead>
                              <TableHead>Coordonnées</TableHead>
                              <TableHead className="w-px px-1 text-right">
                                <span className="sr-only">Actions</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPatientDoctorFollowups.map((followup) => (
                              <TableRow key={followup.id}>
                                <TableCell>
                                  <span className="block font-medium">
                                    {formatDoctorNameFromFollowup(followup)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    RPPS {followup.doctorId}
                                  </span>
                                </TableCell>
                                <TableCell>{followup.specialty}</TableCell>
                                <TableCell>
                                  {formatDoctorFollowupPeriod(followup)}
                                </TableCell>
                                <TableCell>
                                  <span className="block max-w-80 truncate">
                                    {formatDoctorContact(followup)}
                                  </span>
                                  <span className="block max-w-80 truncate text-xs text-muted-foreground">
                                    {followup.doctorPracticeLocations ||
                                      "Lieu non renseigné"}
                                  </span>
                                </TableCell>
                                <TableCell className="w-px px-1">
                                  <div className="flex justify-end gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label={`Modifier le suivi ${followup.specialty}`}
                                            onClick={() =>
                                              handleEditPatientDoctorFollowup(
                                                followup,
                                              )
                                            }
                                          >
                                            <Pencil className="size-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Modifier
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label={`Supprimer le suivi ${followup.specialty}`}
                                            onClick={() =>
                                              void handleDeletePatientDoctorFollowup(
                                                followup,
                                              )
                                            }
                                          >
                                            <Trash2 className="size-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Supprimer
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredPatientDoctorFollowups.length === 0 && (
                              <TableEmptyRow colSpan={5}>
                                {patientDoctorFollowups.length === 0
                                  ? "Aucun médecin assigné"
                                  : "Aucun médecin pour cette spécialité"}
                              </TableEmptyRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <Dialog
                      open={doctorDialogOpen}
                      onOpenChange={setDoctorDialogOpen}
                    >
                      <DialogContent className="sm:max-w-3xl">
                        <form
                          className="grid gap-4"
                          onSubmit={handleSavePatientDoctorFollowup}
                        >
                          <DialogHeader>
                            <DialogTitle>
                              {editingDoctorFollowupId
                                ? "Modifier le suivi médecin"
                                : "Assigner un médecin"}
                            </DialogTitle>
                            <DialogDescription>
                              {patient.lastName} {patient.firstName}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-4">
                            <Field label="Médecin" required>
                              <div className="grid gap-2">
                                <div className="relative">
                                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    className="pl-9"
                                    value={doctorSearch}
                                    placeholder="Nom, prénom ou spécialité"
                                    onChange={(event) => {
                                      const nextSearch = event.target.value;
                                      setDoctorSearch(nextSearch);

                                      if (
                                        selectedDoctor &&
                                        nextSearch !==
                                          formatDoctorName(selectedDoctor)
                                      ) {
                                        setSelectedDoctor(null);
                                        setDoctorFollowupForm((current) => ({
                                          ...current,
                                          doctorId: "",
                                          specialty: "",
                                        }));
                                      }
                                    }}
                                  />
                                </div>

                                {doctorSearchLoading && (
                                  <p className="text-sm text-muted-foreground">
                                    Recherche en cours...
                                  </p>
                                )}

                                {doctorSearchResults.length > 0 && (
                                  <ScrollArea className="max-h-64 rounded-2xl border">
                                    {doctorSearchResults.map((doctor) => (
                                      <button
                                        key={doctor.id}
                                        type="button"
                                        className={cn(
                                          "grid w-full gap-1 border-b p-3 text-left last:border-b-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                          doctorFollowupForm.doctorId ===
                                            doctor.id &&
                                            "bg-primary/10 text-primary",
                                        )}
                                        onClick={() =>
                                          handleSelectDoctor(doctor)
                                        }
                                      >
                                        <span className="font-medium">
                                          {formatDoctorName(doctor)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          RPPS {doctor.id}
                                          {doctor.specialties
                                            ? ` · ${doctor.specialties}`
                                            : ""}
                                        </span>
                                        {doctor.practiceLocations && (
                                          <span className="truncate text-xs text-muted-foreground">
                                            {doctor.practiceLocations}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </ScrollArea>
                                )}

                                {doctorSearch.trim().length >= 2 &&
                                  !doctorSearchLoading &&
                                  doctorSearchResults.length === 0 &&
                                  !selectedDoctor && (
                                    <EmptyState label="Aucun médecin trouvé" />
                                  )}
                              </div>
                            </Field>

                            {selectedDoctor && (
                              <div className="rounded-3xl border bg-muted/20 p-3">
                                <p className="font-medium">
                                  {formatDoctorName(selectedDoctor)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  RPPS {selectedDoctor.id}
                                  {selectedDoctor.specialties
                                    ? ` · ${selectedDoctor.specialties}`
                                    : ""}
                                </p>
                              </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-3">
                              <Field label="Spécialité suivie" required>
                                <Select
                                  value={doctorFollowupForm.specialty}
                                  disabled={
                                    selectedDoctorSpecialties.length <= 1
                                  }
                                  onValueChange={(specialty) =>
                                    setDoctorFollowupForm((current) => ({
                                      ...current,
                                      specialty,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedDoctorSpecialties.map(
                                      (specialty) => (
                                        <SelectItem
                                          key={specialty}
                                          value={specialty}
                                        >
                                          {specialty}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field label="Début" required>
                                <DateTextInput
                                  required
                                  value={doctorFollowupForm.startDate}
                                  onValueChange={(startDate) =>
                                    setDoctorFollowupForm((current) => ({
                                      ...current,
                                      startDate,
                                    }))
                                  }
                                />
                              </Field>
                              <Field label="Fin">
                                <DateTextInput
                                  value={doctorFollowupForm.endDate}
                                  onValueChange={(endDate) =>
                                    setDoctorFollowupForm((current) => ({
                                      ...current,
                                      endDate,
                                    }))
                                  }
                                />
                              </Field>
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDoctorDialogOpen(false)}
                            >
                              Annuler
                            </Button>
                            <Button
                              type="submit"
                              disabled={
                                !doctorFollowupForm.doctorId ||
                                !doctorFollowupForm.specialty ||
                                !doctorFollowupForm.startDate
                              }
                            >
                              {editingDoctorFollowupId
                                ? "Enregistrer"
                                : "Assigner"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </section>
                </PatientTabMotion>
              )}

              {activeTab === "vitals" && (
                <PatientTabMotion key="vitals" direction={tabDirection}>
                  <section className="space-y-4">
                    <SectionTitle
                      icon={Thermometer}
                      title="Constantes vitales"
                      action={
                        <Button
                          type="button"
                          onClick={handleOpenNewVitalDialog}
                        >
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
                    <div className="overflow-hidden rounded-lg border border-border bg-card p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="font-heading text-sm font-medium">
                          Relevé des constantes
                        </h3>
                      </div>
                      <TooltipProvider>
                        <div className="overflow-hidden rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <MedicalColumnHead
                                  label="T"
                                  tooltip="Température corporelle"
                                />
                                <MedicalColumnHead
                                  label="FC"
                                  tooltip="Fréquence cardiaque"
                                />
                                <MedicalColumnHead
                                  label="TA"
                                  tooltip="Tension artérielle"
                                />
                                <MedicalColumnHead
                                  label="SpO2"
                                  tooltip="Saturation pulsée en oxygène et oxygénothérapie"
                                />
                                <MedicalColumnHead
                                  label="Glycémie"
                                  tooltip="Glycémie capillaire"
                                />
                                <MedicalColumnHead
                                  label="Poids"
                                  tooltip="Poids corporel"
                                />
                                <MedicalColumnHead
                                  label="Diurèse"
                                  tooltip="Volume urinaire relevé"
                                />
                                <MedicalColumnHead
                                  label="Selles"
                                  tooltip="Date des dernières selles"
                                />
                                <TableHead className="w-px px-1 text-right">
                                  <span className="sr-only">Actions</span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vitals.map((record) => {
                                const canEditVital = isVitalRecordEditable(
                                  record,
                                  vitalEditNow,
                                );

                                return (
                                  <TableRow
                                    key={record.id}
                                    className={
                                      vitalDialogOpen &&
                                      editingVitalId === record.id
                                        ? "bg-primary/5"
                                        : ""
                                    }
                                  >
                                    <TableCell>
                                      {formatShortDateTime(record.recordedAt)}
                                    </TableCell>
                                    <TableCell>
                                      {record.temperature.toFixed(1)}
                                    </TableCell>
                                    <TableCell>{record.heartRate}</TableCell>
                                    <TableCell>
                                      {record.systolicBloodPressure}/
                                      {record.diastolicBloodPressure}
                                    </TableCell>
                                    <TableCell>
                                      <span className="block">
                                        {record.oxygenSaturation.toFixed(0)}%
                                      </span>
                                      <span className="block text-xs text-muted-foreground">
                                        {formatOxygenTherapy(record)}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {formatBloodGlucose(record)}
                                    </TableCell>
                                    <TableCell>
                                      {record.weight.toFixed(1)} kg
                                    </TableCell>
                                    <TableCell>
                                      {record.diuresis
                                        ? `${record.diuresis} ml`
                                        : "-"}
                                    </TableCell>
                                    <TableCell>
                                      {formatDate(record.lastStoolDate)}
                                    </TableCell>
                                    <TableCell className="w-px px-1">
                                      <div className="flex justify-end gap-1">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="icon-sm"
                                                disabled={!canEditVital}
                                                aria-label={`Modifier la mesure du ${formatShortDateTime(
                                                  record.recordedAt,
                                                )}`}
                                                onClick={() =>
                                                  handleEditVital(record)
                                                }
                                              >
                                                <Pencil className="size-4" />
                                              </Button>
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {canEditVital
                                              ? "Modifier"
                                              : "Modification verrouillée après 30 min"}
                                          </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="destructive"
                                              size="icon-sm"
                                              aria-label={`Supprimer la mesure du ${formatShortDateTime(
                                                record.recordedAt,
                                              )}`}
                                              onClick={() =>
                                                void handleDeleteVital(record)
                                              }
                                            >
                                              <Trash2 className="size-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Supprimer
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {vitals.length === 0 && (
                                <TableEmptyRow colSpan={10}>
                                  Aucune constante
                                </TableEmptyRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TooltipProvider>
                    </div>

                    <Dialog
                      open={vitalDialogOpen}
                      onOpenChange={setVitalDialogOpen}
                    >
                      <DialogContent className="sm:max-w-xl">
                        <form
                          className="grid gap-4"
                          onSubmit={handleSubmitVital}
                        >
                          <DialogHeader>
                            <DialogTitle>
                              {editingVitalId
                                ? "Modifier la mesure"
                                : "Nouvelle mesure"}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                              Saisie des constantes vitales
                            </DialogDescription>
                          </DialogHeader>
                          {editingVitalExpired ? (
                            <AlertMessage
                              message={VITAL_RECORD_EDIT_EXPIRED_MESSAGE}
                            />
                          ) : null}
                          {editingVitalId ? (
                            <Field label="Date et heure" required>
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
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            <NumberField
                              label="Température"
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
                              label="Glycémie (g/L)"
                              required={false}
                              value={vitalForm.bloodGlucose}
                              onChange={(value) =>
                                setVitalForm((current) => ({
                                  ...current,
                                  bloodGlucose: value,
                                }))
                              }
                            />
                            <Field label="Oxygène" required={false}>
                              <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={vitalForm.oxygenTherapy}
                                  onChange={(event) =>
                                    setVitalForm((current) => ({
                                      ...current,
                                      oxygenTherapy: event.target.checked,
                                      oxygenFlowLiters: event.target.checked
                                        ? current.oxygenFlowLiters
                                        : "",
                                    }))
                                  }
                                />
                                <span>Sous oxygène</span>
                              </label>
                            </Field>
                            <Field
                              label="Débit O2 (L/min)"
                              required={vitalForm.oxygenTherapy}
                            >
                              <Input
                                required={vitalForm.oxygenTherapy}
                                disabled={!vitalForm.oxygenTherapy}
                                type="number"
                                step="0.1"
                                min="0"
                                value={vitalForm.oxygenFlowLiters}
                                onChange={(event) =>
                                  setVitalForm((current) => ({
                                    ...current,
                                    oxygenFlowLiters: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <NumberField
                              label="Poids (kg)"
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
                            label="Diurèse"
                            required={false}
                            value={vitalForm.diuresis}
                            onChange={(value) =>
                              setVitalForm((current) => ({
                                ...current,
                                diuresis: value,
                              }))
                            }
                          />
                          <Field label="Dernières selles" required>
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
                            <Button
                              type="submit"
                              disabled={editingVitalExpired}
                            >
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
                </PatientTabMotion>
              )}

              {activeTab === "prescriptions" && (
                <PatientTabMotion key="prescriptions" direction={tabDirection}>
                  <section className="grid gap-4">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
                      <SectionTitle
                        icon={ClipboardList}
                        title="Prescriptions"
                        action={
                          <Button
                            type="button"
                            onClick={handleOpenPrescriptionDialog}
                          >
                            <Plus className="size-4" />
                            Nouvelle prescription
                          </Button>
                        }
                      />

                      <div className="grid gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <ListFilter className="size-3.5" />
                          Filtres
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <Field label="Médicament">
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
                          <Field label="Début min">
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
                          <Field label="Début max">
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
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Médicament</TableHead>
                              <TableHead>Début</TableHead>
                              <TableHead>Fin</TableHead>
                              <TableHead>Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPrescriptions.map((prescription) => (
                              <TableRow key={prescription.id}>
                                <TableCell>{prescription.medication}</TableCell>
                                <TableCell>
                                  {formatDate(prescription.startDate)}
                                </TableCell>
                                <TableCell>
                                  {formatDate(prescription.endDate ?? "")}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={prescription.status}
                                    onValueChange={(status) =>
                                      void handlePrescriptionStatus(
                                        prescription.id,
                                        status,
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
                            {filteredPrescriptions.length === 0 && (
                              <TableEmptyRow colSpan={4}>
                                {prescriptions.length === 0
                                  ? "Aucune prescription"
                                  : "Aucune prescription pour ces filtres"}
                              </TableEmptyRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <Dialog
                      open={prescriptionDialogOpen}
                      onOpenChange={setPrescriptionDialogOpen}
                    >
                      <DialogContent className="sm:max-w-4xl">
                        <PrescriptionForm
                          form={prescriptionForm}
                          onChange={setPrescriptionForm}
                          onSubmit={handleAddPrescription}
                          onCancel={() => setPrescriptionDialogOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </section>
                </PatientTabMotion>
              )}

              {activeTab === "labs" && (
                <PatientTabMotion key="labs" direction={tabDirection}>
                  <section className="grid gap-4">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
                      <SectionTitle
                        icon={FlaskConical}
                        title="Biologie"
                        action={
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleOpenLabRequestDialog}
                            >
                              <Plus className="size-4" />
                              Demander un bilan
                            </Button>
                            <Button
                              type="button"
                              onClick={handleOpenLabResultDialog}
                            >
                              <FlaskConical className="size-4" />
                              Remplir un bilan
                            </Button>
                          </div>
                        }
                      />
                      <div className="grid gap-4">
                        <div className="grid gap-1.5 w-full">
                          <span className="text-sm font-medium">
                            Type de bilan
                          </span>
                          <ToggleGroup
                            type="single"
                            value={activeLabPanelTab}
                            onValueChange={(value) => {
                              if (isLabPanelListTab(value)) {
                                setActiveLabPanelTab(value);
                              }
                            }}
                            className="!w-full justify-start p-0 bg-transparent border-none gap-2 flex"
                          >
                            {LAB_PANEL_LIST_TABS.map((tab) => (
                              <ToggleGroupItem
                                key={tab.value}
                                value={tab.value}
                                aria-label={`Afficher les ${tab.label.toLocaleLowerCase()}`}
                                className="flex-1 border w-auto"
                              >
                                {tab.value === "requests" ? (
                                  <ClipboardList className="size-4" />
                                ) : (
                                  <FlaskConical className="size-4" />
                                )}
                                {tab.label}
                                <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs">
                                  {tab.value === "requests"
                                    ? pendingLabRequestCount
                                    : completedLabPanelCount}
                                </span>
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>

                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <ListFilter className="size-3.5" />
                            Filtres
                          </div>
                          <div className="flex flex-wrap items-end gap-3">
                            <Field label="Type de biologie">
                              <Select
                                value={activeLabPanelFilters.panelType}
                                onValueChange={handleLabPanelFilterChange}
                              >
                                <SelectTrigger className="max-w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">
                                    Tous les bilans
                                  </SelectItem>
                                  {LAB_PANEL_TYPES.map((panelType) => (
                                    <SelectItem
                                      key={panelType}
                                      value={panelType}
                                    >
                                      {panelType}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            {activeLabPanelTab === "completed" && (
                              <Field label="Statut">
                                <Select
                                  value={activeLabPanelFilters.status}
                                  onValueChange={handleLabStatusFilterChange}
                                >
                                  <SelectTrigger className="max-w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">
                                      Tous statuts
                                    </SelectItem>
                                    {LAB_STATUSES.filter(
                                      (status) => status !== "en attente",
                                    ).map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {labStatusLabel(status)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}
                          </div>
                        </div>
                        {activeLabPanelTab === "completed" &&
                          activeLabPanelFilters.panelType !== "all" && (
                          <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Filtres de valeurs
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {labPanelDefinition(
                                activeLabPanelFilters.panelType,
                              ).markers.map((marker) => {
                                const markerFilter =
                                  activeLabPanelFilters.markerFilters[
                                    marker.key
                                  ] ?? emptyLabMarkerRangeFilter();
                                const isFiltered =
                                  hasLabMarkerRangeFilter(markerFilter);

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
                                            "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15",
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
                                    <PopoverContent
                                      align="start"
                                      className="w-56"
                                    >
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
                                                updateLabMarkerFilter(
                                                  marker.key,
                                                  {
                                                    min: event.target.value,
                                                  },
                                                )
                                              }
                                            />
                                          </Field>
                                          <Field label="Max">
                                            <Input
                                              type="number"
                                              step="any"
                                              value={markerFilter.max}
                                              onChange={(event) =>
                                                updateLabMarkerFilter(
                                                  marker.key,
                                                  {
                                                    max: event.target.value,
                                                  },
                                                )
                                              }
                                            />
                                          </Field>
                                        </div>
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant="outline"
                                          disabled={!isFiltered}
                                          onClick={() =>
                                            clearLabMarkerFilter(marker.key)
                                          }
                                        >
                                          Effacer
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {activeLabPanelTab === "requests" ? (
                          <div className="grid gap-2">
                            <h3 className="font-heading text-sm font-medium">
                              Demandes de bilan
                            </h3>
                            <div className="overflow-hidden rounded-lg border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Demande</TableHead>
                                    <TableHead>Bilan</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">
                                      Action
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pendingLabRequests.map((panel) => (
                                    <TableRow
                                      key={panel.id}
                                      className="cursor-pointer"
                                      onClick={() => setSelectedLabPanel(panel)}
                                    >
                                      <TableCell>
                                        {formatShortDateTime(panel.sampledAt)}
                                      </TableCell>
                                      <TableCell>{panel.panelType}</TableCell>
                                      <TableCell className="max-w-80 truncate text-muted-foreground">
                                        {panel.note || "-"}
                                      </TableCell>
                                      <TableCell>
                                        <StatusBadge label={panel.status} />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          type="button"
                                          size="xs"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleOpenPendingLabResultDialog(
                                              panel,
                                            );
                                          }}
                                        >
                                          <FlaskConical className="size-3" />
                                          Remplir
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {pendingLabRequests.length === 0 && (
                                    <TableEmptyRow colSpan={5}>
                                      {pendingLabRequestCount === 0
                                        ? "Aucune demande de bilan"
                                        : "Aucune demande pour ces filtres"}
                                    </TableEmptyRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            <h3 className="font-heading text-sm font-medium">
                              Bilans remplis
                            </h3>
                            <div className="overflow-hidden rounded-lg border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Prélèvement</TableHead>
                                    <TableHead>Bilan</TableHead>
                                    <TableHead>Valeurs</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead>Apercu</TableHead>
                                    <TableHead>Statut</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {completedLabPanels.map((panel) => (
                                    <TableRow
                                      key={panel.id}
                                      className="cursor-pointer"
                                      onClick={() => setSelectedLabPanel(panel)}
                                    >
                                      <TableCell>
                                        {formatShortDateTime(panel.sampledAt)}
                                      </TableCell>
                                      <TableCell>{panel.panelType}</TableCell>
                                      <TableCell>
                                        {panel.results.length}
                                      </TableCell>
                                      <TableCell className="max-w-64 truncate text-muted-foreground">
                                        {panel.note || "-"}
                                      </TableCell>
                                      <TableCell>
                                        {formatLabPanelPreview(panel)}
                                      </TableCell>
                                      <TableCell>
                                        <StatusBadge label={panel.status} />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {completedLabPanels.length === 0 && (
                                    <TableEmptyRow colSpan={6}>
                                      {completedLabPanelCount === 0
                                        ? "Aucun bilan rempli"
                                        : "Aucun bilan rempli pour ces filtres"}
                                    </TableEmptyRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                  <LabPanelDialog
                    form={labForm}
                    mode={labDialogMode ?? "request"}
                    open={labDialogMode !== null}
                    onChange={setLabForm}
                    onOpenChange={(open) => {
                      if (!open) {
                        setLabDialogMode(null);
                        setSelectedPendingLabPanelId(null);
                      }
                    }}
                    onSubmit={handleSubmitLab}
                    pendingPanel={
                      labDialogMode === "result"
                        ? (selectedPendingLabPanel ??
                          pendingLabPanelForFormType)
                        : null
                    }
                    lockPanelType={selectedPendingLabPanel !== null}
                  />
                  <LabPanelDetailsDialog
                    panel={selectedLabPanel}
                    onOpenChange={(open) => {
                      if (!open) {
                        setSelectedLabPanel(null);
                      }
                    }}
                  />
                </PatientTabMotion>
              )}

              {activeTab === "documents" && (
                <PatientTabMotion key="documents" direction={tabDirection}>
                  <section className="grid gap-4">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
                      <SectionTitle
                        icon={FileText}
                        title="Documents medicaux"
                        action={
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleOpenDocumentDialog}
                          >
                            <Plus className="size-4" />
                            Ajouter
                          </Button>
                        }
                      />
                      <div className="grid gap-3 lg:grid-cols-[auto_minmax(12rem,18rem)_minmax(16rem,1fr)] lg:items-center">
                        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <ListFilter className="size-3.5" />
                          Filtres
                        </span>
                        <Select
                          value={documentFilter}
                          onValueChange={(value) =>
                            setDocumentFilter(
                              value as MedicalDocumentCategory | "all",
                            )
                          }
                        >
                          <SelectTrigger className="max-w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              Toutes categories
                            </SelectItem>
                            {DOCUMENT_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {DOCUMENT_CATEGORY_LABELS[category]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={documentNoteSearch}
                            placeholder="Rechercher dans les notes des documents"
                            onChange={(event) =>
                              setDocumentNoteSearch(event.target.value)
                            }
                          />
                        </div>
                      </div>
                      {visibleDocuments.length === 0 ? (
                        <EmptyState
                          label={
                            documents.length === 0
                              ? "Aucun document"
                              : "Aucun document ne correspond à cette recherche"
                          }
                        />
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {visibleDocuments.map((document) => (
                            <article
                              key={document.id}
                              className="grid gap-3 rounded-3xl border bg-background p-4 text-sm"
                            >
                              <div>
                                <p className="break-words font-medium leading-snug">
                                  {document.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {DOCUMENT_CATEGORY_LABELS[document.category]}{" "}
                                  · {formatShortDateTime(document.createdAt)}
                                </p>
                              </div>
                              <div className="break-words text-xs text-muted-foreground">
                                {document.originalFileName ??
                                  document.storagePath ??
                                  "Référence"}
                                {document.fileSizeBytes
                                  ? ` · ${formatFileSize(document.fileSizeBytes)}`
                                  : ""}
                              </div>
                              {document.note && (
                                <RichTextDisplay
                                  className="text-xs leading-relaxed text-muted-foreground"
                                  value={document.note}
                                />
                              )}
                              <div className="flex flex-wrap gap-2">
                                {canOpenDicomViewer(document) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleViewDicomDocument(document)
                                    }
                                  >
                                    <ScanLine className="size-4" />
                                    Visualiser
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void handleOpenDocument(document.id)
                                  }
                                >
                                  <ExternalLink className="size-4" />
                                  Ouvrir
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    void handleDownloadDocument(document)
                                  }
                                >
                                  <Download className="size-4" />
                                  Fichier
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                    <Dialog
                      open={documentDialogOpen}
                      onOpenChange={handleDocumentDialogOpenChange}
                    >
                      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
                        <ScrollArea className="max-h-[calc(90vh-3rem)]">
                          <form
                            className="grid gap-4 pr-4"
                            onSubmit={handleAddDocument}
                          >
                            <DialogHeader>
                              <DialogTitle>Ajouter un document</DialogTitle>
                              <DialogDescription className="sr-only">
                                Ajouter un document medical au dossier du
                                patient.
                              </DialogDescription>
                            </DialogHeader>
                            <Field label="Titre" required>
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
                            <Field label="Categorie" required>
                              <Select
                                value={documentForm.category}
                                onValueChange={(category) =>
                                  setDocumentForm((current) => ({
                                    ...current,
                                    category:
                                      category as MedicalDocumentCategory,
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
                            <Field label="Note">
                              <RichTextNoteField
                                className="min-h-28"
                                title="Note du document"
                                placeholder="Note"
                                value={documentForm.note}
                                onChange={(value) =>
                                  setDocumentForm((current) => ({
                                    ...current,
                                    note: value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Référence fichier">
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
                              <input
                                key={documentFileKey}
                                type="file"
                                className="peer sr-only"
                                onChange={(
                                  event: ChangeEvent<HTMLInputElement>,
                                ) =>
                                  setDocumentFile(
                                    event.target.files?.[0] ?? null,
                                  )
                                }
                              />
                              <div
                                className={cn(
                                  "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                                  documentFileDragging
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-input bg-muted/20 text-foreground hover:border-primary/60 hover:bg-muted/40",
                                )}
                                onDragEnter={handleDocumentFileDragEnter}
                                onDragLeave={handleDocumentFileDragLeave}
                                onDragOver={handleDocumentFileDragOver}
                                onDrop={handleDocumentFileDrop}
                              >
                                <FileUp
                                  className={cn(
                                    "size-5",
                                    documentFileDragging
                                      ? "text-primary"
                                      : "text-muted-foreground",
                                  )}
                                />
                                <span className="text-sm font-medium">
                                  {documentFileDragging
                                    ? "Déposez le fichier ici"
                                    : "Cliquez ou déposez un fichier ici"}
                                </span>
                                <span className="max-w-full break-all text-xs text-muted-foreground">
                                  {documentFile
                                    ? `${documentFile.name} · ${formatFileSize(documentFile.size)}`
                                    : "Aucun fichier sélectionné"}
                                </span>
                              </div>
                            </Field>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDocumentDialogOpen(false)}
                              >
                                Annuler
                              </Button>
                              <Button type="submit">
                                <FileUp className="size-4" />
                                Ajouter
                              </Button>
                            </DialogFooter>
                          </form>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </section>
                </PatientTabMotion>
              )}

              {activeTab === "evolution" && (
                <PatientTabMotion key="evolution" direction={tabDirection}>
                  <section className="rounded-lg border border-border bg-card p-3">
                    <SectionTitle icon={Activity} title="Evolution clinique" />
                    <div className="grid gap-1.5 w-full">
                      <span className="text-sm font-medium">Type de note</span>
                      <ToggleGroup
                        type="single"
                        value={evolutionNoteRoleFilter}
                        onValueChange={(value) => {
                          if (
                            value === "doctor" ||
                            value === "nurse" ||
                            value === "other"
                          ) {
                            setEvolutionNoteRoleFilter(value);
                          }
                        }}
                        className="!w-full justify-start p-0 bg-transparent border-none gap-2 flex"
                      >
                        <ToggleGroupItem
                          value="doctor"
                          aria-label="Afficher les notes médecin"
                          className="flex-1 border w-auto"
                        >
                          <Stethoscope className="size-4" />
                          Notes médecin
                          <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs">
                            {doctorEvolutionNoteCount}
                          </span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="nurse"
                          aria-label="Afficher les notes infirmières"
                          className="flex-1 border w-auto"
                        >
                          <ClipboardList className="size-4" />
                          Notes infirmières
                          <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs">
                            {nurseEvolutionNoteCount}
                          </span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="other"
                          aria-label="Afficher les autres notes"
                          className="flex-1 border w-auto"
                        >
                          <FileText className="size-4" />
                          Autres
                          <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs">
                            {otherEvolutionNoteCount}
                          </span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(14rem,20rem)_auto] lg:items-end">
                      <Field label="Recherche">
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={evolutionSearch}
                            placeholder="Rechercher dans le contenu des notes"
                            onChange={(event) =>
                              setEvolutionSearch(event.target.value)
                            }
                          />
                        </div>
                      </Field>
                      <Field label="Service">
                        <Select
                          value={evolutionServiceFilter}
                          onValueChange={setEvolutionServiceFilter}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EVOLUTION_ACTIVE_SERVICE_FILTER}>
                              Service actif
                              {activeEvolutionService
                                ? ` (${activeEvolutionService})`
                                : ""}
                            </SelectItem>
                            <SelectItem value="all">
                              Tous les services
                            </SelectItem>
                            {evolutionServiceOptions.map((serviceName) => (
                              <SelectItem key={serviceName} value={serviceName}>
                                {serviceName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-5 grid gap-5">
                      <EvolutionNoteSection
                        title={evolutionNoteSectionTitle(
                          evolutionNoteRoleFilter,
                        )}
                        notes={visibleEvolutionNotes}
                        emptyLabel={evolutionNoteEmptyLabel(
                          evolutionNoteRoleFilter,
                        )}
                        onCreate={handleOpenNewEvolutionNoteEditor}
                        onSelect={setSelectedEvolutionNote}
                      />
                    </div>
                    <Dialog
                      open={selectedEvolutionNote !== null}
                      onOpenChange={(open) => {
                        if (!open) {
                          setSelectedEvolutionNote(null);
                        }
                      }}
                    >
                      <DialogContent className="max-h-[90vh] sm:max-w-5xl">
                        {selectedEvolutionNote && (
                          <ScrollArea className="max-h-[calc(90vh-3rem)]">
                            <div className="grid gap-5 pr-4">
                              <DialogHeader>
                                <DialogTitle>
                                  Note du{" "}
                                  {formatShortDateTime(
                                    selectedEvolutionNote.recordedAt,
                                  )}
                                </DialogTitle>
                                <DialogDescription>
                                  {selectedEvolutionNote.service} · Passage{" "}
                                  {selectedEvolutionNote.visitId} ·{" "}
                                  {selectedEvolutionNote.author} ·{" "}
                                  {evolutionNoteAuthorRoleLabel(
                                    selectedEvolutionNote.authorRole,
                                  )}
                                </DialogDescription>
                              </DialogHeader>
                              <section className="grid gap-2 rounded-lg border border-border bg-card p-3">
                                {selectedEvolutionNoteVital ? (
                                  <>
                                    <p className="text-sm font-semibold text-foreground">
                                      Constantes -{" "}
                                      {formatShortDateTime(
                                        selectedEvolutionNoteVital.recordedAt,
                                      )}
                                    </p>
                                    <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2">
                                      {selectedEvolutionNoteVitalSummaryItems.map(
                                        (item) => (
                                          <PatientInfoBadge
                                            key={item.label}
                                            className={cn(
                                              "w-full min-w-0 font-normal",
                                              vitalStatusClass(
                                                item.statusSeverity,
                                              ),
                                              item.spanTwoColumns &&
                                                "sm:col-span-2",
                                            )}
                                          >
                                            <span
                                              className="flex w-full min-w-0 items-baseline gap-2 whitespace-nowrap"
                                              title={item.statusLabel}
                                              aria-label={
                                                item.statusLabel
                                                  ? `${item.label} ${item.value}. ${item.statusLabel}`
                                                  : undefined
                                              }
                                            >
                                              <span className="shrink-0 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                                                {item.label}
                                              </span>
                                              <span className="min-w-0 truncate font-semibold text-foreground">
                                                {item.value}
                                              </span>
                                            </span>
                                          </PatientInfoBadge>
                                        ),
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-semibold text-foreground">
                                      Constantes
                                    </p>
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Aucune constante avant cette note
                                    </p>
                                  </>
                                )}
                              </section>
                              <ScrollArea className="max-h-[35vh] rounded-3xl border bg-background">
                                <RichTextDisplay
                                  className="p-4 leading-6"
                                  value={selectedEvolutionNote.content}
                                />
                              </ScrollArea>
                            </div>
                          </ScrollArea>
                        )}
                      </DialogContent>
                    </Dialog>
                  </section>
                </PatientTabMotion>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function EvolutionNoteSection({
  title,
  notes,
  emptyLabel,
  onCreate,
  onSelect,
}: {
  title: string;
  notes: EvolutionNote[];
  emptyLabel: string;
  onCreate: () => void;
  onSelect: (note: EvolutionNote) => void;
}) {
  const noteCountLabel =
    notes.length === 1 ? "1 note affichée" : `${notes.length} notes affichées`;

  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{noteCountLabel}</p>
        </div>
      </div>
      <div className="grid gap-3">
        <EvolutionNotePlaceholder label={emptyLabel} onCreate={onCreate} />
        {notes.map((note) => (
          <EvolutionNoteCard key={note.id} note={note} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function EvolutionNotePlaceholder({
  label,
  onCreate,
}: {
  label: string;
  onCreate: () => void;
}) {
  return (
    <button
      type="button"
      className="group grid h-56 min-h-56 w-full place-items-center rounded-3xl border-2 border-dashed border-input bg-muted/20 p-4 text-center text-sm transition hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label="Créer une nouvelle note"
      onClick={onCreate}
    >
      <span className="flex max-w-44 flex-col items-center gap-3">
        <span className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xs transition group-hover:border-primary/50 group-hover:text-primary">
          <Plus className="size-5" />
        </span>
        <span className="font-medium">Nouvelle note</span>
        <span className="text-xs leading-5 text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

function EvolutionNoteCard({
  note,
  onSelect,
}: {
  note: EvolutionNote;
  onSelect: (note: EvolutionNote) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "group grid h-56 min-h-56 w-full content-start overflow-hidden rounded-3xl border p-4 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        evolutionNoteRoleCardClass(note.authorRole),
      )}
      aria-label={`Ouvrir la note du ${formatShortDateTime(note.recordedAt)}`}
      onClick={() => onSelect(note)}
    >
      <span className="flex items-start justify-between gap-2">
        <span>
          <span className="block text-4xl leading-none font-semibold text-foreground">
            {formatEvolutionNoteDay(note.recordedAt)}
          </span>
          <span className="mt-1 block text-xs font-medium text-muted-foreground uppercase">
            {formatEvolutionNoteMonth(note.recordedAt)}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-xs font-medium",
            evolutionNoteRoleBadgeClass(note.authorRole),
          )}
        >
          {evolutionNoteAuthorRoleLabel(note.authorRole)}
        </span>
      </span>
      <span className="mt-2 truncate font-medium">
        {note.service} · Passage {note.visitId}
      </span>
      <span className="mt-1 truncate text-xs text-muted-foreground">
        {note.author} · {formatEvolutionNoteTime(note.recordedAt)}
      </span>
      <span className="mt-2 overflow-hidden leading-5 text-muted-foreground whitespace-pre-wrap [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5]">
        {richTextToPlainText(note.content)}
      </span>
    </button>
  );
}

function formatDoctorName(doctor: Doctor) {
  const name = [doctor.civility, doctor.firstName, doctor.lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return name || `RPPS ${doctor.id}`;
}

function formatDoctorNameFromFollowup(followup: PatientDoctorFollowup) {
  const name = [
    followup.doctorCivility,
    followup.doctorFirstName,
    followup.doctorLastName,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return name || `RPPS ${followup.doctorId}`;
}

function doctorFromFollowup(followup: PatientDoctorFollowup): Doctor {
  return {
    id: followup.doctorId,
    nationalId: followup.doctorNationalId,
    civility: followup.doctorCivility,
    firstName: followup.doctorFirstName,
    lastName: followup.doctorLastName,
    professionCode: "10",
    professionLabel: followup.doctorProfessionLabel,
    categoryCode: "",
    categoryLabel: "",
    specialties: followup.doctorSpecialties,
    specialtyCodes: "",
    practiceModes: "",
    practiceLocations: followup.doctorPracticeLocations,
    phoneNumbers: followup.doctorPhoneNumbers,
    emails: followup.doctorEmails,
    source: "ANS_RPPS",
    sourceUpdatedAt: null,
    createdAt: followup.createdAt,
    updatedAt: followup.updatedAt,
  };
}

function doctorSpecialtyOptions(doctor: Doctor) {
  const specialties = splitSemicolonValues(doctor.specialties);

  if (specialties.length > 0) {
    return specialties;
  }

  return doctor.professionLabel ? [doctor.professionLabel] : [];
}

function splitSemicolonValues(value: string) {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !/^\+\d+$/.test(item));
}

function formatDoctorFollowupPeriod(followup: PatientDoctorFollowup) {
  const start = formatDate(followup.startDate);
  const end = followup.endDate ? formatDate(followup.endDate) : "En cours";

  return `${start} - ${end}`;
}

function formatDoctorContact(followup: PatientDoctorFollowup) {
  const contacts = [
    ...splitSemicolonValues(followup.doctorPhoneNumbers),
    ...splitSemicolonValues(followup.doctorEmails),
  ];

  return contacts.length > 0 ? contacts.join(" · ") : "Contact non renseigné";
}

function patientUpdateToastFromRealtimeEvent(
  event: RealtimeEvent,
): PatientUpdateToast | null {
  if (event.action !== "created") {
    return null;
  }

  const detail = patientUpdateToastDetail(event);

  return detail ? { id: event.id, detail } : null;
}

function vitalRecordsToChartData(records: VitalRecord[]): VitalChartPoint[] {
  return [...records].reverse().map((record) => ({
    label: formatShortDateTime(record.recordedAt),
    temperature: record.temperature,
    heartRate: record.heartRate,
    systolicBloodPressure: record.systolicBloodPressure,
    diastolicBloodPressure: record.diastolicBloodPressure,
    oxygenSaturation: record.oxygenSaturation,
    bloodGlucose: record.bloodGlucose ?? null,
    weight: record.weight,
    diuresis: record.diuresis ?? null,
  }));
}

function isVitalRecordEditable(record: VitalRecord, now = Date.now()) {
  const createdAt = new Date(record.createdAt).getTime();

  if (Number.isNaN(createdAt)) {
    return true;
  }

  return now - createdAt <= VITAL_RECORD_EDIT_WINDOW_MS;
}

function formatBloodGlucose(record: VitalRecord | null) {
  return record?.bloodGlucose != null
    ? `${record.bloodGlucose.toFixed(2)} g/L`
    : "Non renseignée";
}

function formatOxygenSaturation(record: VitalRecord) {
  return `${record.oxygenSaturation.toFixed(0)} % (${formatOxygenTherapy(record)})`;
}

function formatOxygenTherapy(record: VitalRecord) {
  if (!record.oxygenTherapy) {
    return "Air ambiant";
  }

  return record.oxygenFlowLiters != null
    ? `O2 ${record.oxygenFlowLiters} L/min`
    : "O2";
}

function vitalStatusProps(
  status: VitalStatus | null,
): Pick<VitalSummaryItem, "statusLabel" | "statusSeverity"> {
  return status
    ? { statusLabel: status.label, statusSeverity: status.severity }
    : {};
}

function buildVitalSummaryItems(
  record: VitalRecord,
  patient?: Patient | null,
): VitalSummaryItem[] {
  const diuresisStatus = vitalDiuresisStatus(record.diuresis, record.weight);

  return [
    {
      label: "T",
      value: `${record.temperature.toFixed(1)} C`,
      ...vitalStatusProps(vitalTemperatureStatus(record.temperature)),
    },
    {
      label: "FC",
      value: `${record.heartRate} bpm`,
      ...vitalStatusProps(vitalHeartRateStatus(record.heartRate)),
    },
    {
      label: "TA",
      value: `${record.systolicBloodPressure}/${record.diastolicBloodPressure} mmHg`,
      ...vitalStatusProps(
        vitalBloodPressureStatus(
          record.systolicBloodPressure,
          record.diastolicBloodPressure,
        ),
      ),
      spanTwoColumns: true,
    },
    {
      label: "SpO2",
      value: formatOxygenSaturation(record),
      ...vitalStatusProps(
        vitalOxygenSaturationStatus(
          record.oxygenSaturation,
          record.oxygenTherapy,
        ),
      ),
      spanTwoColumns: true,
    },
    {
      label: "Glycémie",
      value: formatBloodGlucose(record),
      ...vitalStatusProps(vitalBloodGlucoseStatus(record.bloodGlucose)),
    },
    {
      label: "Poids",
      value: `${record.weight.toFixed(1)} kg`,
      ...vitalStatusProps(vitalWeightStatus(record, patient)),
    },
    record.diuresis != null
      ? {
          label: "Diurèse",
          value: `${record.diuresis} ml`,
          ...vitalStatusProps(diuresisStatus),
        }
      : { label: "Diurèse", value: "N/A" },
    record.lastStoolDate
      ? {
          label: "Selles",
          value: formatDate(record.lastStoolDate),
          ...vitalStatusProps(
            vitalLastStoolStatus(record.lastStoolDate, record.recordedAt),
          ),
        }
      : { label: "Selles", value: "non renseignées" },
  ];
}

function vitalTemperatureStatus(value: number): VitalStatus {
  if (!Number.isFinite(value) || value < 30 || value > 43) {
    return { severity: 4, label: "Température hors plage physiologique adulte" };
  }

  if (value <= 35) {
    return { severity: 3, label: "Hypothermie critique (NEWS2: 3)" };
  }

  if (value <= 36) {
    return { severity: 1, label: "Température basse (NEWS2: 1)" };
  }

  if (value <= 37.5) {
    return { severity: 0, label: "Température normale (36.1-37.5 C)" };
  }

  if (value < 38) {
    return { severity: 1, label: "Température subfébrile (37.6-37.9 C)" };
  }

  if (value < 39.1) {
    return { severity: 2, label: "Fièvre (>=38.0 C)" };
  }

  if (value >= 41) {
    return { severity: 4, label: "Hyperthermie critique (>=41.0 C)" };
  }

  return { severity: 3, label: "Fièvre élevée (>=39.1 C)" };
}

function vitalHeartRateStatus(value: number): VitalStatus {
  if (!Number.isFinite(value) || value < 20 || value > 220) {
    return {
      severity: 4,
      label: "Fréquence cardiaque hors plage physiologique adulte",
    };
  }

  if (value <= 40) {
    return { severity: 3, label: "Bradycardie critique (NEWS2: 3)" };
  }

  if (value <= 50) {
    return { severity: 1, label: "Bradycardie modérée (NEWS2: 1)" };
  }

  if (value <= 90) {
    return { severity: 0, label: "Fréquence cardiaque normale (51-90 bpm)" };
  }

  if (value <= 110) {
    return { severity: 1, label: "Tachycardie légère (NEWS2: 1)" };
  }

  if (value <= 130) {
    return { severity: 2, label: "Tachycardie marquée (NEWS2: 2)" };
  }

  return { severity: 3, label: "Tachycardie critique (NEWS2: 3)" };
}

function vitalBloodPressureStatus(
  systolic: number,
  diastolic: number,
): VitalStatus {
  if (
    !Number.isFinite(systolic) ||
    !Number.isFinite(diastolic) ||
    systolic <= 0 ||
    diastolic <= 0 ||
    diastolic >= systolic ||
    systolic < 50 ||
    diastolic < 30 ||
    systolic > 260 ||
    diastolic > 150
  ) {
    return { severity: 4, label: "Tension hors plage physiologique adulte" };
  }

  if (systolic > 180 || diastolic > 120) {
    return { severity: 3, label: "Hypertension sévère (>180/120 mmHg)" };
  }

  if (systolic <= 90) {
    return { severity: 3, label: "Hypotension critique (NEWS2: 3)" };
  }

  if (systolic <= 100) {
    return { severity: 2, label: "Hypotension marquée (NEWS2: 2)" };
  }

  if (systolic <= 110) {
    return { severity: 1, label: "Tension systolique basse (NEWS2: 1)" };
  }

  if (systolic >= 220) {
    return { severity: 3, label: "Tension systolique critique (NEWS2: 3)" };
  }

  if (systolic >= 160 || diastolic >= 100) {
    return { severity: 2, label: "Hypertension marquée" };
  }

  if (systolic >= 130 || diastolic >= 85) {
    return { severity: 1, label: "Tension au-dessus de la zone normale" };
  }

  if (diastolic < 60) {
    return { severity: 1, label: "Tension diastolique basse" };
  }

  return { severity: 0, label: "Tension dans la zone normale" };
}

function vitalOxygenSaturationStatus(
  value: number,
  oxygenTherapy: boolean,
): VitalStatus {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { severity: 4, label: "SpO2 hors plage mesurable" };
  }

  if (value < 70) {
    return { severity: 4, label: "SpO2 extrêmement basse" };
  }

  if (value <= 91) {
    return { severity: 3, label: "SpO2 critique (NEWS2: 3)" };
  }

  if (value <= 93) {
    return { severity: 2, label: "SpO2 basse (NEWS2: 2)" };
  }

  if (value <= 95) {
    return { severity: 1, label: "SpO2 limite (NEWS2: 1)" };
  }

  if (oxygenTherapy) {
    return { severity: 1, label: "SpO2 correcte mais patient sous oxygène" };
  }

  return { severity: 0, label: "SpO2 normale en air ambiant" };
}

function vitalBloodGlucoseStatus(
  value: number | null | undefined,
): VitalStatus | null {
  if (value == null) {
    return null;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return { severity: 4, label: "Glycémie hors plage mesurable" };
  }

  if (value < 0.54) {
    return {
      severity: 4,
      label: "Hypoglycémie cliniquement significative (<0.54 g/L)",
    };
  }

  if (value < 0.7) {
    return { severity: 3, label: "Hypoglycémie (<0.70 g/L)" };
  }

  if (value <= 1.8) {
    return {
      severity: 0,
      label: "Glycémie dans la cible hospitalière usuelle",
    };
  }

  if (value < 2) {
    return { severity: 1, label: "Hyperglycémie légère (>1.80 g/L)" };
  }

  if (value < 2.5) {
    return { severity: 2, label: "Hyperglycémie significative (>=2.00 g/L)" };
  }

  if (value < 6) {
    return { severity: 3, label: "Hyperglycémie sévère" };
  }

  return {
    severity: 4,
    label: "Hyperglycémie majeure compatible avec HHS (>=6.00 g/L)",
  };
}

function vitalWeightStatus(
  record: VitalRecord,
  patient?: Patient | null,
): VitalStatus {
  const weight = record.weight;
  const heightMeters = heightInMeters(record.height ?? patient?.height);

  if (!Number.isFinite(weight) || weight <= 0 || weight < 25 || weight > 454) {
    return { severity: 4, label: "Poids hors plage adulte plausible" };
  }

  if (heightMeters != null) {
    const bmi = weight / heightMeters ** 2;

    if (!Number.isFinite(bmi) || bmi < 10 || bmi > 80) {
      return { severity: 4, label: "IMC hors plage adulte plausible" };
    }

    if (bmi < 16) {
      return { severity: 4, label: `IMC très bas (${bmi.toFixed(1)})` };
    }

    if (bmi < 17) {
      return { severity: 3, label: `IMC bas sévère (${bmi.toFixed(1)})` };
    }

    if (bmi < 18.5) {
      return { severity: 2, label: `IMC bas (${bmi.toFixed(1)})` };
    }

    if (bmi < 25) {
      return { severity: 0, label: `IMC normal (${bmi.toFixed(1)})` };
    }

    if (bmi < 30) {
      return { severity: 1, label: `Surpoids selon IMC (${bmi.toFixed(1)})` };
    }

    if (bmi < 35) {
      return {
        severity: 2,
        label: `Obésité classe 1 selon IMC (${bmi.toFixed(1)})`,
      };
    }

    if (bmi < 40) {
      return {
        severity: 3,
        label: `Obésité classe 2 selon IMC (${bmi.toFixed(1)})`,
      };
    }

    return {
      severity: 4,
      label: `Obésité classe 3 selon IMC (${bmi.toFixed(1)})`,
    };
  }

  if (weight < 35 || weight > 250) {
    return {
      severity: 3,
      label: "Poids adulte très atypique sans taille renseignée",
    };
  }

  if (weight < 45 || weight > 200) {
    return {
      severity: 2,
      label: "Poids adulte atypique sans taille renseignée",
    };
  }

  if (weight < 50 || weight > 180) {
    return { severity: 1, label: "Poids à interpréter avec la taille" };
  }

  return { severity: 0, label: "Poids dans une plage adulte plausible" };
}

function vitalDiuresisStatus(
  diuresis: number | null | undefined,
  weight: number,
): VitalStatus | null {
  if (diuresis == null) {
    return null;
  }

  if (!Number.isFinite(diuresis) || diuresis <= 0) {
    return { severity: 4, label: "Diurèse hors plage mesurable" };
  }

  if (Number.isFinite(weight) && weight > 0) {
    const hourlyRate = diuresis / weight / 24;

    if (hourlyRate < 0.1) {
      return {
        severity: 4,
        label: `Diurèse quasi nulle (${hourlyRate.toFixed(2)} ml/kg/h)`,
      };
    }

    if (hourlyRate < 0.3) {
      return {
        severity: 3,
        label: `Oligurie sévère (${hourlyRate.toFixed(2)} ml/kg/h)`,
      };
    }

    if (hourlyRate < 0.5) {
      return {
        severity: 2,
        label: `Oligurie (<0.5 ml/kg/h, ${hourlyRate.toFixed(2)})`,
      };
    }
  } else if (diuresis < 400) {
    return { severity: 3, label: "Oligurie probable (<400 ml/24h)" };
  }

  if (diuresis > 5000) {
    return { severity: 3, label: "Polyurie très importante (>5 L/24h)" };
  }

  if (diuresis > 3000) {
    return { severity: 2, label: "Polyurie (>3 L/24h)" };
  }

  return { severity: 0, label: "Diurèse dans la plage attendue" };
}

function vitalLastStoolStatus(
  lastStoolDate: string,
  referenceDate: string,
): VitalStatus | null {
  const stoolDay = dateOnlyTimestamp(lastStoolDate);
  const referenceDay = dateOnlyTimestamp(referenceDate);

  if (stoolDay == null || referenceDay == null) {
    return null;
  }

  const days = Math.floor((referenceDay - stoolDay) / DAY_MS);

  if (days < 0) {
    return { severity: 2, label: "Date des selles postérieure à la mesure" };
  }

  if (days <= 2) {
    return { severity: 0, label: "Transit récent" };
  }

  if (days === 3) {
    return { severity: 1, label: "Dernières selles il y a 3 jours" };
  }

  if (days <= 5) {
    return { severity: 2, label: `Constipation possible (${days} jours)` };
  }

  if (days <= 6) {
    return { severity: 3, label: `Constipation marquée (${days} jours)` };
  }

  return { severity: 4, label: `Constipation sévère (${days} jours)` };
}

function heightInMeters(height: number | null | undefined) {
  if (height == null || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  return height > 3 ? height / 100 : height;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyTimestamp(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

function findLastVitalBefore(
  records: VitalRecord[],
  referenceDate: string,
): VitalRecord | null {
  const referenceTime = dateTimeTimestamp(referenceDate);

  if (referenceTime === Number.NEGATIVE_INFINITY) {
    return null;
  }

  return (
    records
      .filter((record) => dateTimeTimestamp(record.recordedAt) < referenceTime)
      .sort(compareVitalRecordsNewestFirst)[0] ?? null
  );
}

function compareVitalRecordsNewestFirst(a: VitalRecord, b: VitalRecord) {
  const aRecordedAt = dateTimeTimestamp(a.recordedAt);
  const bRecordedAt = dateTimeTimestamp(b.recordedAt);

  if (aRecordedAt !== bRecordedAt) {
    return bRecordedAt - aRecordedAt;
  }

  const aCreatedAt = dateTimeTimestamp(a.createdAt);
  const bCreatedAt = dateTimeTimestamp(b.createdAt);

  if (aCreatedAt !== bCreatedAt) {
    return bCreatedAt - aCreatedAt;
  }

  return 0;
}

function dateTimeTimestamp(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function buildVitalChartPanels(
  latestVital: VitalRecord | null,
  vitalChartData: VitalChartPoint[],
): VitalChartPanel[] {
  return [
    {
      id: "temperature",
      title: "Température",
      latestValue: latestVital
        ? `${latestVital.temperature.toFixed(1)} C`
        : "Non renseignée",
      emptyLabel: "Aucune température renseignée",
      data: vitalChartData,
      lines: [
        {
          dataKey: "temperature",
          name: "Température",
          stroke: "var(--chart-4)",
          unit: "C",
          decimals: 1,
        },
      ],
    },
    {
      id: "heart-rate",
      title: "Fréquence cardiaque",
      latestValue: latestVital
        ? `${latestVital.heartRate} bpm`
        : "Non renseignée",
      emptyLabel: "Aucune fréquence renseignée",
      data: vitalChartData,
      lines: [
        {
          dataKey: "heartRate",
          name: "FC",
          stroke: "var(--chart-2)",
          unit: "bpm",
          decimals: 0,
        },
      ],
    },
    {
      id: "blood-pressure",
      title: "Tension artérielle",
      latestValue: latestVital
        ? `${latestVital.systolicBloodPressure}/${latestVital.diastolicBloodPressure} mmHg`
        : "Non renseignée",
      emptyLabel: "Aucune tension renseignée",
      data: vitalChartData,
      lines: [
        {
          dataKey: "systolicBloodPressure",
          name: "Systolique",
          stroke: "var(--chart-3)",
          unit: "mmHg",
          decimals: 0,
          labelPosition: "top",
        },
        {
          dataKey: "diastolicBloodPressure",
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
        ? formatOxygenSaturation(latestVital)
        : "Non renseignée",
      emptyLabel: "Aucune SpO2 renseignée",
      data: vitalChartData,
      lines: [
        {
          dataKey: "oxygenSaturation",
          name: "SpO2",
          stroke: "var(--chart-1)",
          unit: "%",
          decimals: 0,
        },
      ],
    },
    {
      id: "blood-glucose",
      title: "Glycémie",
      latestValue: formatBloodGlucose(latestVital),
      emptyLabel: "Aucune glycémie renseignée",
      data: vitalChartData,
      lines: [
        {
          dataKey: "bloodGlucose",
          name: "Glycémie",
          stroke: "var(--chart-5)",
          unit: "g/L",
          decimals: 2,
        },
      ],
    },
    {
      id: "weight",
      title: "Poids",
      latestValue: latestVital
        ? `${latestVital.weight.toFixed(1)} kg`
        : "Non renseigné",
      emptyLabel: "Aucun poids renseigné",
      data: vitalChartData,
      lines: [
        {
          dataKey: "weight",
          name: "Poids",
          stroke: "var(--chart-3)",
          unit: "kg",
          decimals: 1,
        },
      ],
    },
    {
      id: "diuresis",
      title: "Diurèse",
      latestValue:
        latestVital?.diuresis != null
          ? `${latestVital.diuresis} ml`
          : "Non renseignée",
      emptyLabel: "Aucune diurèse renseignée",
      data: vitalChartData,
      lines: [
        {
          dataKey: "diuresis",
          name: "Diurèse",
          stroke: "var(--chart-2)",
          unit: "ml",
          decimals: 0,
        },
      ],
    },
  ];
}

function findPendingLabPanelForType(
  labs: LabPanel[],
  panelType: LabPanelType,
) {
  return (
    labs
      .filter(
        (panel) =>
          panel.status === "en attente" && panel.panelType === panelType,
      )
      .sort(
        (left, right) =>
          left.sampledAt.localeCompare(right.sampledAt) ||
          left.createdAt.localeCompare(right.createdAt),
      )[0] ?? null
  );
}

function evolutionNoteAuthorRoleLabel(role: UserRole | undefined) {
  return role ? ROLE_LABELS[role] : "Auteur";
}

function evolutionNoteRoleFilterFromRole(
  role: UserRole | undefined,
): EvolutionNoteRoleFilter {
  return role === "doctor" || role === "nurse" ? role : "other";
}

function evolutionNoteSectionTitle(filter: EvolutionNoteRoleFilter) {
  if (filter === "doctor") {
    return "Notes médecin";
  }

  if (filter === "nurse") {
    return "Notes infirmières";
  }

  return "Autres notes";
}

function evolutionNoteEmptyLabel(filter: EvolutionNoteRoleFilter) {
  if (filter === "doctor") {
    return "Aucune note médecin pour ce service";
  }

  if (filter === "nurse") {
    return "Aucune note infirmière pour ce service";
  }

  return "Aucune autre note pour ce service";
}

function evolutionNoteRoleCardClass(role: UserRole | undefined) {
  if (role === "doctor") {
    return "border-sky-200 bg-sky-50/70 hover:border-sky-300 hover:bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20";
  }

  if (role === "nurse") {
    return "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20";
  }

  return "border-border bg-background hover:border-primary/40 hover:bg-muted/30";
}

function evolutionNoteRoleBadgeClass(role: UserRole | undefined) {
  if (role === "doctor") {
    return "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300";
  }

  if (role === "nurse") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  return "border-border bg-muted text-muted-foreground";
}

function patientUpdateToastDetail(event: RealtimeEvent) {
  if (event.entity === "vitalRecord") {
    const recordedAt = patientUpdatePayloadText(event, "recordedAt");
    return recordedAt
      ? `Constantes ajoutees: ${formatShortDateTime(recordedAt)}`
      : "Constantes ajoutees";
  }

  if (event.entity === "prescription") {
    const medication = patientUpdatePayloadText(event, "medication");
    const dosage = patientUpdatePayloadText(event, "dosage");
    return patientUpdateDetailWithValue(
      "Prescription ajoutee",
      [medication, dosage].filter(Boolean).join(" - "),
    );
  }

  if (event.entity === "patientDoctorFollowup") {
    const specialty = patientUpdatePayloadText(event, "specialty");
    return patientUpdateDetailWithValue("Medecin assigne", specialty);
  }

  if (event.entity === "labPanel") {
    return patientUpdateDetailWithValue(
      event.action === "updated"
        ? "Bilan biologique mis a jour"
        : "Bilan biologique ajoute",
      patientUpdatePayloadText(event, "panelType"),
    );
  }

  if (event.entity === "medicalDocument") {
    const title = patientUpdatePayloadText(event, "title");
    const category = patientUpdateDocumentCategoryLabel(
      patientUpdatePayloadText(event, "category"),
    );

    return patientUpdateDetailWithValue(
      "Document ajoute",
      [title, category].filter(Boolean).join(" - "),
    );
  }

  if (event.entity === "evolutionNote") {
    return patientUpdateDetailWithValue(
      "Note d'evolution ajoutee",
      patientUpdatePayloadText(event, "author"),
    );
  }

  return null;
}

function patientUpdateDetailWithValue(label: string, value: string | null) {
  return value ? `${label}: ${value}` : label;
}

function patientUpdatePayloadText(event: RealtimeEvent, key: string) {
  if (!isRealtimePayloadRecord(event.payload)) {
    return null;
  }

  const value = event.payload[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function patientUpdateDocumentCategoryLabel(category: string | null) {
  if (!category) {
    return null;
  }

  return (
    DOCUMENT_CATEGORY_LABELS[category as MedicalDocumentCategory] ?? category
  );
}

function isRealtimePayloadRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function PatientSexIcon({ sex }: { sex?: PatientSex | null }) {
  if (sex !== "female" && sex !== "male") {
    return null;
  }

  const Icon = sex === "female" ? Venus : Mars;

  return (
    <span
      aria-label={`Sexe: ${patientSexLabel(sex)}`}
      title={patientSexLabel(sex)}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background",
        sex === "female"
          ? "border-pink-300 text-pink-600 dark:border-pink-400/40 dark:text-pink-200"
          : "border-blue-300 text-blue-600 dark:border-blue-400/40 dark:text-blue-200",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function PatientTabMotion({
  children,
  direction,
}: {
  children: ReactNode;
  direction: "forward" | "backward";
}) {
  return (
    <motion.div
      className="col-start-1 row-start-1 min-h-full min-w-0 text-sm outline-none"
      custom={direction}
      variants={patientTabVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={PATIENT_TAB_TRANSITION}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}

function isPatientTab(value: string | undefined): value is PatientTab {
  return PATIENT_TAB_VALUES.includes(value as PatientTab);
}

function requiresEntranceExamBeforeClinicalData(tab: PatientTab) {
  return !["summary", "entrance", "doctors"].includes(tab);
}

function formatPatientAge(birthDate: string) {
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return "Non renseigné";
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const birth = new Date(year, month - 1, day);

  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return "Non renseigné";
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() > month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() >= day);

  if (!birthdayHasPassed) {
    age -= 1;
  }

  if (age < 0) {
    return "Non renseigné";
  }

  return `${age} ${age > 1 ? "ans" : "an"}`;
}

function formatPatientRoomBed(beds: Bed[], bedId?: string | null) {
  if (!bedId) {
    return "Non assigné";
  }

  const bed = beds.find((candidate) => candidate.id === bedId);

  if (!bed) {
    return bedId;
  }

  const room = bed.room.trim();
  const label = bed.label.trim();

  if (room && label) {
    return `Chambre ${room}, lit ${label}`;
  }

  if (room) {
    return `Chambre ${room}`;
  }

  if (label) {
    return `Lit ${label}`;
  }

  return "Non assigné";
}
