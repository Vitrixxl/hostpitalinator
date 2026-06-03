import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
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
  Pencil,
  Plus,
  PlusIcon,
  Save,
  Search,
  Stethoscope,
  Thermometer,
  Trash2,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useNavigate, useParams } from "react-router";

import {
  addEvolutionNote,
  addLabResult,
  addMedicalDocument,
  addPrescription,
  addVitalRecord,
  archivePatient,
  deleteVitalRecord,
  downloadMedicalDocument,
  endPatientVisit,
  getEntranceExam,
  getLatestVitalRecord,
  getPatient,
  listEvolutionNotes,
  listEntranceExams,
  listLabResults,
  listMedicalDocuments,
  listPrescriptions,
  listVitalRecords,
  openMedicalDocument,
  saveEntranceExam,
  setRealtimeContext,
  startNewPatientVisit,
  subscribeRealtime,
  type RealtimeEvent,
  updatePatient,
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
  emptyDocumentForm,
  emptyEvolutionForm,
  emptyEntranceExamForm,
  emptyLabForm,
  emptyPatientForm,
  emptyPrescriptionFilters,
  emptyPrescriptionForm,
  emptyVitalForm,
  entranceExamFormToInput,
  entranceExamToForm,
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
  EntranceExamFormState,
  EvolutionFormState,
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
import { ClinicalValue, MedicalColumnHead } from "@/components/common/Display";
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
  QuickActionDialog,
  type QuickAction,
} from "@/components/common/QuickActionDialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LabPanelDetailsDialog } from "@/features/labs/components/LabPanelDetailsDialog";
import { LabPanelDialog } from "@/features/labs/components/LabPanelDialog";
import { EntranceExamPanel } from "./EntranceExamPanel";
import { PatientFormFields } from "./PatientFormFields";
import { PrescriptionForm } from "@/features/prescriptions/components/PrescriptionForm";
import { VitalMeasureChart } from "@/features/vitals/components/VitalMeasureChart";
import { cn } from "@/lib/utils";
import { LAB_PANEL_TYPES, labPanelDefinition } from "@/types";
import type {
  Account,
  Bed,
  EvolutionNote,
  EntranceExamRecord,
  LabPanel,
  LabPanelType,
  MedicalDocument,
  MedicalDocumentCategory,
  Patient,
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

const patientTabVariants = {
  enter: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? "100%" : "-100%",
  }),
  center: {
    x: 0,
  },
  exit: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? "-100%" : "100%",
  }),
};

const PATIENT_UPDATE_TOAST_DURATION_MS = 4200;
const ENTRANCE_EXAM_HISTORY_PAGE_SIZE = 5;

type PatientUpdateToast = {
  id: string;
  detail: string;
};

const DEFAULT_EVOLUTION_VITAL_PANEL_IDS = [
  "temperature",
  "heart-rate",
  "blood-pressure",
  "oxygen-saturation",
  "weight",
  "diuresis",
];

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
  const [evolutionDraftOpen, setEvolutionDraftOpen] = useState(false);
  const [hasEvolutionDraft, setHasEvolutionDraft] = useState(false);
  const [evolutionVitalPanelIds, setEvolutionVitalPanelIds] = useState<
    string[]
  >(DEFAULT_EVOLUTION_VITAL_PANEL_IDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [documentFilter, setDocumentFilter] = useState<
    MedicalDocumentCategory | "all"
  >("all");
  const [labPanelFilter, setLabPanelFilter] = useState<LabPanelType | "all">(
    "all",
  );
  const [labStatusFilter, setLabStatusFilter] = useState("all");
  const [labMarkerFilters, setLabMarkerFilters] = useState<
    Record<string, LabMarkerRangeFilter>
  >({});
  const [prescriptionFilters, setPrescriptionFilters] =
    useState<PrescriptionFilters>(emptyPrescriptionFilters());
  const [patientForm, setPatientForm] =
    useState<PatientFormState>(emptyPatientForm());
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [placementBedId, setPlacementBedId] = useState("");
  const [endVisitDialogOpen, setEndVisitDialogOpen] = useState(false);
  const [newVisitDialogOpen, setNewVisitDialogOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [vitalForm, setVitalForm] = useState<VitalFormState>(emptyVitalForm());
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null);
  const [vitalDialogOpen, setVitalDialogOpen] = useState(false);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [prescriptionForm, setPrescriptionForm] =
    useState<PrescriptionFormState>(emptyPrescriptionForm());
  const [labForm, setLabForm] = useState<LabFormState>(emptyLabForm());
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [documentForm, setDocumentForm] =
    useState<DocumentFormState>(emptyDocumentForm());
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileKey, setDocumentFileKey] = useState(0);
  const [documentOpenPath, setDocumentOpenPath] = useState("");
  const [evolutionForm, setEvolutionForm] = useState<EvolutionFormState>(
    emptyEvolutionForm(currentAccount),
  );
  const [patientUpdateToast, setPatientUpdateToast] =
    useState<PatientUpdateToast | null>(null);
  const patientUpdateToastTimeoutRef = useRef<number | undefined>(undefined);

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
      setEvolutionForm((current) => ({
        ...current,
        service: snapshot.patient.currentService || currentAccount.service,
      }));
    },
    [currentAccount.service],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");

    const cachedSnapshot = peekPatientWorkspaceSnapshot(
      patientId,
      documentFilter,
    );

    if (cachedSnapshot) {
      applyWorkspaceSnapshot(cachedSnapshot);
      setLoading(false);
    }

    try {
      const snapshot = await getPatientWorkspaceSnapshot(patientId, {
        documentFilter,
        force: Boolean(cachedSnapshot),
      });

      applyWorkspaceSnapshot(snapshot);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [applyWorkspaceSnapshot, documentFilter, patientId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadWorkspace]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
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
        patient?.currentVisitId !== patientResult.currentVisitId;

      setPatient(patientResult);
      setPatientForm(patientToForm(patientResult));
      if (visitChanged) {
        const entranceExam = await getEntranceExam(patientId);

        setEntranceExamForm(entranceExamToForm(entranceExam));
        setHasCurrentEntranceExam(Boolean(entranceExam.exam));
        setEntranceExamHistory([]);
        setHasMoreEntranceExams(true);
      }
      onPatientChanged();
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [onPatientChanged, patient, patientId]);

  const refreshVitals = useCallback(async () => {
    try {
      const [latestVitalResult, vitalResults] = await Promise.all([
        getLatestVitalRecord(patientId),
        listVitalRecords(patientId),
      ]);

      setLatestVital(latestVitalResult);
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
          offset: reset ? 0 : entranceExamHistory.length,
        });

        setEntranceExamHistory((current) =>
          reset ? exams : [...current, ...exams],
        );
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
    [entranceExamHistory.length, patientId],
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
      !patient?.currentVisitId ||
      hasCurrentEntranceExam
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      showEntranceExamGateMessage();
      navigate(`/patients/${patientId}/entrance`, { replace: true });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeTab, hasCurrentEntranceExam, navigate, patient, patientId]);

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

    return subscribeRealtime(handleRealtimeEvent);
  }, [activeTab, handleRealtimeEvent, patientId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickActionOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const vitalChartData = useMemo(
    () => vitalRecordsToChartData(vitals),
    [vitals],
  );

  const vitalChartPanels = useMemo<VitalChartPanel[]>(
    () => buildVitalChartPanels(latestVital, vitalChartData),
    [latestVital, vitalChartData],
  );

  const selectedEvolutionNoteVitals = useMemo(() => {
    if (!selectedEvolutionNote) {
      return [];
    }

    const noteDay = dateInput(selectedEvolutionNote.recordedAt);

    return vitals.filter((record) => dateInput(record.recordedAt) === noteDay);
  }, [selectedEvolutionNote, vitals]);

  const selectedEvolutionNoteVitalChartData = useMemo(
    () => vitalRecordsToChartData(selectedEvolutionNoteVitals),
    [selectedEvolutionNoteVitals],
  );

  const selectedEvolutionNoteVitalChartPanels = useMemo(
    () =>
      buildVitalChartPanels(
        selectedEvolutionNoteVitals[0] ?? null,
        selectedEvolutionNoteVitalChartData,
      ),
    [selectedEvolutionNoteVitalChartData, selectedEvolutionNoteVitals],
  );

  const visibleEvolutionNoteVitalChartPanels = useMemo(
    () =>
      selectedEvolutionNoteVitalChartPanels.filter((panel) =>
        evolutionVitalPanelIds.includes(panel.id),
      ),
    [evolutionVitalPanelIds, selectedEvolutionNoteVitalChartPanels],
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

  const filteredLabs = useMemo(() => {
    const activeMarkerFilters =
      labPanelFilter === "all"
        ? []
        : labPanelDefinition(labPanelFilter)
            .markers.map((marker) => ({
              markerKey: marker.key,
              filter: labMarkerFilters[marker.key],
            }))
            .filter(
              (
                item,
              ): item is { markerKey: string; filter: LabMarkerRangeFilter } =>
                hasLabMarkerRangeFilter(item.filter),
            );

    return labs.filter((panel) => {
      if (labPanelFilter !== "all" && panel.panelType !== labPanelFilter) {
        return false;
      }

      if (labStatusFilter !== "all" && panel.status !== labStatusFilter) {
        return false;
      }

      if (activeMarkerFilters.length > 0) {
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

      return true;
    });
  }, [labMarkerFilters, labPanelFilter, labStatusFilter, labs]);

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

  const hasPrescriptionFilters = useMemo(
    () =>
      Object.values(prescriptionFilters).some(
        (filterValue) => filterValue.trim() !== "",
      ),
    [prescriptionFilters],
  );

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

  async function handleUpdatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        administrativeInfo: nullableOptionalValue(
          patientForm.administrativeInfo,
        ),
        bedId: nullableOptionalValue(patientForm.bedId),
      });
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
      setPatientForm(patientToForm(updated));
      setEntranceExamForm(entranceExamToForm(entranceExam));
      setHasCurrentEntranceExam(Boolean(entranceExam.exam));
      setEntranceExamHistory([]);
      setHasMoreEntranceExams(true);
      setNewVisitDialogOpen(false);
      invalidatePatientWorkspaceSnapshot(patientId);
      onPatientChanged();
      navigate(`/patients/${patientId}/entrance`);
    }, "Nouvelle visite créée");
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

  async function handleArchivePatient() {
    await runAction(async () => {
      const archived = await archivePatient(patientId);
      setPatient(archived);
      invalidatePatientWorkspaceSnapshot(patientId);
      onPatientChanged();
    }, "Dossier archive");
  }

  async function handleSubmitVital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
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
        await loadWorkspace();
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

      await loadWorkspace();
    }, "Mesure supprimée");
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
        await loadWorkspace();
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

  function handleOpenPrescriptionQuickAction() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setPrescriptionForm(emptyPrescriptionForm());
    setPrescriptionDialogOpen(true);
    navigate(`/patients/${patientId}/prescriptions`);
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
      await loadWorkspace();
    }, "Statut modifie");
  }

  async function handleAddLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    await runAction(async () => {
      const results = labFormResultsToInput(labForm);

      if (results.length === 0) {
        throw new Error("Renseignez au moins une valeur biologique");
      }

      await addLabResult(patientId, {
        sampledAt: labForm.sampledAt,
        panelType: labForm.panelType,
        status: worstLabStatus(results.map((result) => result.status)),
        results,
      });
      setLabForm(emptyLabForm());
      setLabDialogOpen(false);
      await loadWorkspace();
    }, "Bilan biologique ajoute");
  }

  function handleOpenLabDialog() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setLabForm(emptyLabForm());
    setLabDialogOpen(true);
  }

  function updateLabMarkerFilter(
    markerKey: string,
    patch: Partial<LabMarkerRangeFilter>,
  ) {
    setLabMarkerFilters((current) => ({
      ...current,
      [markerKey]: {
        ...emptyLabMarkerRangeFilter(),
        ...current[markerKey],
        ...patch,
      },
    }));
  }

  function clearLabMarkerFilter(markerKey: string) {
    setLabMarkerFilters((current) => {
      const remainingFilters = { ...current };
      delete remainingFilters[markerKey];
      return remainingFilters;
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
        storagePath: optionalValue(documentForm.storagePath),
        ...filePayload,
      });
      setDocumentForm(emptyDocumentForm());
      setDocumentFile(null);
      setDocumentFileKey((current) => current + 1);
      await loadWorkspace();
    }, "Document ajoute");
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

  async function handleAddEvolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    await runAction(async () => {
      await addEvolutionNote(patientId, {
        service: patient?.currentService ?? currentAccount.service,
        visitId: evolutionForm.visitId,
        author: currentAccount.name,
        recordedAt: nowLocalInput(),
        content: evolutionForm.content,
      });
      setEvolutionForm((current) => ({
        ...emptyEvolutionForm(
          currentAccount,
          patient?.currentVisitId ?? undefined,
        ),
        service: patient?.currentService ?? current.service,
      }));
      setHasEvolutionDraft(false);
      setEvolutionDraftOpen(false);
      await loadWorkspace();
    }, "Note d'evolution ajoutee");
  }

  function handleStartEvolutionDraft() {
    if (!ensureEntranceExamBeforeClinicalData()) {
      return;
    }

    setEvolutionForm((current) => ({
      ...(hasEvolutionDraft
        ? current
        : emptyEvolutionForm(
            currentAccount,
            patient?.currentVisitId ?? undefined,
          )),
      service: patient?.currentService ?? current.service,
    }));
    setHasEvolutionDraft(true);
    setEvolutionDraftOpen(true);
  }

  function handleStartEvolutionQuickAction() {
    handleStartEvolutionDraft();
    navigate(`/patients/${patientId}/evolution`);
  }

  function handleToggleEvolutionVitalPanel(panelId: string) {
    setEvolutionVitalPanelIds((current) =>
      current.includes(panelId)
        ? current.filter((id) => id !== panelId)
        : [...current, panelId],
    );
  }

  function handleEditPatientQuickAction() {
    navigate(`/patients/${patientId}/summary`);
  }

  function handleTabChange(value: string) {
    const nextTab = value as PatientTab;

    if (nextTab === activeTab) {
      return;
    }

    if (
      requiresEntranceExamBeforeClinicalData(nextTab) &&
      entranceExamGateIsActive()
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

  function entranceExamGateIsActive() {
    return Boolean(patient?.currentVisitId) && !hasCurrentEntranceExam;
  }

  function showEntranceExamGateMessage() {
    setSuccess("");
    setError(
      "Enregistrez l'examen d'entrée de cette visite avant de modifier les données cliniques.",
    );
  }

  function ensureEntranceExamBeforeClinicalData() {
    if (!entranceExamGateIsActive()) {
      return true;
    }

    showEntranceExamGateMessage();
    navigate(`/patients/${patientId}/entrance`);
    return false;
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
  const entranceExamLocked = entranceExamGateIsActive();
  const placementButtonLabel = patient.bedId
    ? "Changer de chambre"
    : "Ajouter a une chambre";
  const quickActions: QuickAction[] = [
    {
      id: "create-current-prescription",
      label: "Créer une prescription pour le patient en cours",
      run: handleOpenPrescriptionQuickAction,
    },
    {
      id: "evolution-note",
      label: "Faire une note d'evolution",
      run: handleStartEvolutionQuickAction,
    },
    {
      id: "add-prescription",
      label: "Ajouter une prescription",
      run: handleOpenPrescriptionQuickAction,
    },
    {
      id: "edit-patient",
      label: "Modifier les informations",
      run: handleEditPatientQuickAction,
    },
  ];

  return (
    <div className="space-y-5">
      <QuickActionDialog
        open={quickActionOpen}
        actions={quickActions}
        onOpenChange={setQuickActionOpen}
      />

      <AnimatePresence>
        {patientUpdateToast && (
          <motion.div
            key={patientUpdateToast.id}
            aria-live="polite"
            className="fixed top-4 left-1/2 z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2"
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

      <div className="flex flex-col gap-2 rounded-3xl border bg-background p-4 shadow">
        <div className="flex gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="self-start"
                size="icon"
                onClick={() => navigate("/patients")}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <h2 className="font-heading text-2xl font-medium">
                {patient.lastName} {patient.firstName}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="flex px-2 h-8 w-full min-w-[15rem] items-center gap-3 rounded-full border border-input/60 bg-background/80  text-sm text-muted-foreground shadow-sm transition-[color,box-shadow] hover:bg-background focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary/20 focus-visible:outline-none sm:w-72 "
              onClick={() => setQuickActionOpen(true)}
            >
              <Search className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">
                Actions rapides
              </span>
              <kbd className="shrink-0 rounded-lg bg-muted px-1.5 py-0.5 font-mono !text-xs text-foreground ">
                Ctrl+K
              </kbd>
            </button>
            {hasActiveVisit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={Boolean(patient.archivedAt)}
                onClick={handleOpenPlacementDialog}
              >
                <PlusIcon className="size-4" />
                {placementButtonLabel}
              </Button>
            )}
            {!hasActiveVisit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={Boolean(patient.archivedAt)}
                onClick={() => setNewVisitDialogOpen(true)}
              >
                <Plus className="size-4" />
                Nouvelle visite
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-fit"
              disabled={!hasActiveVisit}
              onClick={() => setEndVisitDialogOpen(true)}
            >
              <LogOutIcon className="size-4" />
              Fin de visite
            </Button>
          </div>
        </div>
      </div>

      {error && <AlertMessage message={error} />}
      {success && <AlertMessage tone="success" message={success} />}
      {documentOpenPath && (
        <AlertMessage
          tone="success"
          message={`Référence: ${documentOpenPath}`}
        />
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
              <div className="rounded-3xl border bg-background p-4 shadow">
                <p className="text-xs text-muted-foreground">Lit actuel</p>
                <p className="mt-1 font-medium">
                  {bedLabel(beds, patient.bedId)}
                </p>
              </div>

              <div className="max-h-[50vh] overflow-y-auto rounded-3xl border bg-background">
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
                              "shrink-0 rounded-full border px-2 py-1 text-xs",
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
              </div>
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
        <TabsList className="flex !h-auto w-full flex-wrap justify-start rounded-3xl border border-border/70 bg-background p-1.5 shadow">
          {PATIENT_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              aria-disabled={
                entranceExamLocked &&
                requiresEntranceExamBeforeClinicalData(tab.value)
              }
              className={cn(
                "shadow-none flex h-8 items-center rounded-lg",
                entranceExamLocked &&
                  requiresEntranceExamBeforeClinicalData(tab.value) &&
                  "opacity-50",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid overflow-x-hidden pb-2">
          <AnimatePresence initial={false} custom={tabDirection} mode="sync">
            {activeTab === "summary" && (
              <PatientTabMotion key="summary" direction={tabDirection}>
                <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <form
                    className="grid gap-4 rounded-3xl border bg-background p-4 shadow"
                    onSubmit={handleUpdatePatient}
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
                      currentPatientId={patient.id}
                      form={patientForm}
                      showBedField={false}
                      services={services}
                      onChange={setPatientForm}
                    />
                  </form>

                  <section className="space-y-4 rounded-3xl border bg-background p-4 shadow">
                    <SectionTitle icon={Activity} title="Dernières données" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ClinicalValue
                        label="Température"
                        value={
                          latestVital
                            ? `${latestVital.temperature.toFixed(1)} C`
                            : "Non renseignée"
                        }
                      />
                      <ClinicalValue
                        label="Fréquence cardiaque"
                        value={
                          latestVital
                            ? `${latestVital.heartRate} bpm`
                            : "Non renseignée"
                        }
                      />
                      <ClinicalValue
                        label="Tension"
                        value={
                          latestVital
                            ? `${latestVital.systolicBloodPressure}/${latestVital.diastolicBloodPressure}`
                            : "Non renseignée"
                        }
                      />
                      <ClinicalValue
                        label="SpO2"
                        value={
                          latestVital
                            ? `${latestVital.oxygenSaturation.toFixed(0)} %`
                            : "Non renseignée"
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
                  onChange={setEntranceExamForm}
                  onLoadMore={() => void loadEntranceExamHistory()}
                  onSubmit={handleSaveEntranceExam}
                />
              </PatientTabMotion>
            )}

            {activeTab === "vitals" && (
              <PatientTabMotion key="vitals" direction={tabDirection}>
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
                  <div className="overflow-hidden rounded-3xl border bg-background p-4 shadow">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-heading text-sm font-medium">
                        Relevé des constantes
                      </h3>
                    </div>
                    <TooltipProvider>
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
                              tooltip="Saturation pulsée en oxygène"
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
                              <TableCell>
                                {record.temperature.toFixed(1)}
                              </TableCell>
                              <TableCell>{record.heartRate}</TableCell>
                              <TableCell>
                                {record.systolicBloodPressure}/
                                {record.diastolicBloodPressure}
                              </TableCell>
                              <TableCell>
                                {record.oxygenSaturation.toFixed(0)}%
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
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        aria-label={`Modifier la mesure du ${formatShortDateTime(
                                          record.recordedAt,
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
                                          record.recordedAt,
                                        )}`}
                                        onClick={() =>
                                          void handleDeleteVital(record)
                                        }
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

                  <Dialog
                    open={vitalDialogOpen}
                    onOpenChange={setVitalDialogOpen}
                  >
                    <DialogContent forceMount className="sm:max-w-xl">
                      <form className="grid gap-4" onSubmit={handleSubmitVital}>
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
              </PatientTabMotion>
            )}

            {activeTab === "prescriptions" && (
              <PatientTabMotion key="prescriptions" direction={tabDirection}>
                <section className="grid gap-4">
                  <div className="space-y-4 rounded-3xl border bg-background p-4 shadow">
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

                    <div className="overflow-auto">
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
                        </TableBody>
                      </Table>
                    </div>
                    {prescriptions.length === 0 && (
                      <EmptyState label="Aucune prescription" />
                    )}
                    {prescriptions.length > 0 &&
                      filteredPrescriptions.length === 0 && (
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
                  <div className="space-y-4 rounded-3xl border bg-background p-4 shadow">
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
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <ListFilter className="size-3.5" />
                        Filtres
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <Field label="Type de biologie">
                          <Select
                            value={labPanelFilter}
                            onValueChange={(value) => {
                              setLabPanelFilter(value as LabPanelType | "all");
                              setLabMarkerFilters({});
                            }}
                          >
                            <SelectTrigger className="max-w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">
                                Tous les bilans
                              </SelectItem>
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
                    </div>
                    {labPanelFilter !== "all" && (
                      <div className="grid gap-2 rounded-3xl border bg-background p-4 shadow">
                        <p className="text-xs font-medium text-muted-foreground">
                          Filtres de valeurs
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {labPanelDefinition(labPanelFilter).markers.map(
                            (marker) => {
                              const markerFilter =
                                labMarkerFilters[marker.key] ??
                                emptyLabMarkerRangeFilter();
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
                            },
                          )}
                        </div>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prélèvement</TableHead>
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
                            <TableCell>
                              {formatShortDateTime(panel.sampledAt)}
                            </TableCell>
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
                      setSelectedLabPanel(null);
                    }
                  }}
                />
              </PatientTabMotion>
            )}

            {activeTab === "documents" && (
              <PatientTabMotion key="documents" direction={tabDirection}>
                <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-4 rounded-3xl border bg-background p-4 shadow">
                    <SectionTitle
                      icon={FileText}
                      title="Documents medicaux"
                      action={
                        <div className="flex flex-wrap items-center justify-end gap-2">
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
                        </div>
                      }
                    />
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {documents.map((document) => (
                        <article
                          key={document.id}
                          className="grid gap-3 rounded-3xl border bg-background p-4 text-sm shadow"
                        >
                          <div>
                            <p className="font-medium">{document.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {DOCUMENT_CATEGORY_LABELS[document.category]} ·{" "}
                              {formatShortDateTime(document.createdAt)}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {document.originalFileName ??
                              document.storagePath ??
                              "Référence"}
                            {document.fileSizeBytes
                              ? ` · ${formatFileSize(document.fileSizeBytes)}`
                              : ""}
                          </div>
                          <div className="flex flex-wrap gap-2">
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
                    {documents.length === 0 && (
                      <EmptyState label="Aucun document" />
                    )}
                  </div>
                  <form
                    className="grid content-start gap-3 rounded-3xl border bg-background p-4 shadow"
                    onSubmit={handleAddDocument}
                  >
                    <SectionTitle icon={FileUp} title="Ajouter un document" />
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
              </PatientTabMotion>
            )}

            {activeTab === "evolution" && (
              <PatientTabMotion key="evolution" direction={tabDirection}>
                {evolutionDraftOpen ? (
                  <form
                    className="grid gap-4 rounded-3xl border bg-background p-4 shadow"
                    onSubmit={handleAddEvolution}
                  >
                    <div className="grid gap-1">
                      <h2 className="font-heading text-base font-medium">
                        Nouvelle note d'évolution
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Saisissez uniquement le contenu clinique de la note.
                      </p>
                    </div>
                    <Field label="Contenu" required>
                      <Textarea
                        required
                        className="min-h-72"
                        placeholder="Contenu de la note"
                        value={evolutionForm.content}
                        onChange={(event) =>
                          setEvolutionForm((current) => ({
                            ...current,
                            content: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEvolutionDraftOpen(false)}
                      >
                        <FileText className="size-4" />
                        Retour aux notes
                      </Button>
                      <Button type="submit">
                        <Plus className="size-4" />
                        Ajouter
                      </Button>
                    </div>
                  </form>
                ) : (
                  <section className="rounded-3xl border bg-background p-4 shadow">
                    <SectionTitle icon={Activity} title="Evolution clinique" />
                    <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
                      <button
                        type="button"
                        className="group grid aspect-square min-h-56 place-items-center rounded-3xl border border-dashed bg-background p-4 text-center text-primary shadow transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={
                          hasEvolutionDraft
                            ? "Reprendre la note en cours"
                            : "Ajouter une nouvelle note"
                        }
                        onClick={handleStartEvolutionDraft}
                      >
                        <span className="grid place-items-center gap-2">
                          {hasEvolutionDraft ? (
                            <Pencil className="size-10" />
                          ) : (
                            <Plus className="size-10" />
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {hasEvolutionDraft ? "Reprendre" : "Nouvelle note"}
                          </span>
                          {hasEvolutionDraft && (
                            <span className="text-xs text-muted-foreground">
                              Brouillon en cours
                            </span>
                          )}
                        </span>
                      </button>
                      {notes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          className={cn(
                            "group grid aspect-square min-h-56 content-start overflow-hidden rounded-3xl border p-4 text-left text-sm shadow transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            evolutionNoteRoleCardClass(note.authorRole),
                          )}
                          aria-label={`Ouvrir la note du ${formatShortDateTime(
                            note.recordedAt,
                          )}`}
                          onClick={() => setSelectedEvolutionNote(note)}
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
                                "shrink-0 rounded-full border px-2 py-1 text-xs font-medium",
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
                            {note.author} ·{" "}
                            {formatEvolutionNoteTime(note.recordedAt)}
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
                          setSelectedEvolutionNote(null);
                        }
                      }}
                    >
                      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                        {selectedEvolutionNote && (
                          <div className="grid gap-5">
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
                            <div className="max-h-[35vh] overflow-y-auto rounded-3xl border bg-background p-4 leading-6 whitespace-pre-wrap shadow">
                              {selectedEvolutionNote.content}
                            </div>
                            <section className="grid gap-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <h3 className="font-heading text-base font-medium">
                                  Constantes du{" "}
                                  {formatDate(
                                    dateInput(selectedEvolutionNote.recordedAt),
                                  )}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                  {selectedEvolutionNoteVitalChartPanels.map(
                                    (panel) => {
                                      const selected =
                                        evolutionVitalPanelIds.includes(
                                          panel.id,
                                        );

                                      return (
                                        <Button
                                          key={panel.id}
                                          type="button"
                                          size="xs"
                                          variant="outline"
                                          aria-pressed={selected}
                                          className={cn(
                                            selected &&
                                              "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15",
                                          )}
                                          onClick={() =>
                                            handleToggleEvolutionVitalPanel(
                                              panel.id,
                                            )
                                          }
                                        >
                                          {panel.title}
                                        </Button>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                              {selectedEvolutionNoteVitals.length === 0 ? (
                                <EmptyState label="Aucune constante sur cette journee" />
                              ) : visibleEvolutionNoteVitalChartPanels.length >
                                0 ? (
                                <div className="grid gap-3 lg:grid-cols-2">
                                  {visibleEvolutionNoteVitalChartPanels.map(
                                    (panel) => (
                                      <VitalMeasureChart
                                        key={panel.id}
                                        panel={panel}
                                      />
                                    ),
                                  )}
                                </div>
                              ) : (
                                <EmptyState label="Aucune constante sélectionnée" />
                              )}
                            </section>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </section>
                )}
              </PatientTabMotion>
            )}
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
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
    weight: record.weight,
    diuresis: record.diuresis ?? null,
  }));
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
      data: vitalChartData.map((point) => ({
        label: point.label,
        value: point.temperature,
      })),
      lines: [
        {
          dataKey: "value",
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
      title: "Tension artérielle",
      latestValue: latestVital
        ? `${latestVital.systolicBloodPressure}/${latestVital.diastolicBloodPressure} mmHg`
        : "Non renseignée",
      emptyLabel: "Aucune tension renseignée",
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
        : "Non renseignée",
      emptyLabel: "Aucune SpO2 renseignée",
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
        : "Non renseigné",
      emptyLabel: "Aucun poids renseigné",
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
      title: "Diurèse",
      latestValue:
        latestVital?.diuresis != null
          ? `${latestVital.diuresis} ml`
          : "Non renseignée",
      emptyLabel: "Aucune diurèse renseignée",
      data: vitalChartData.map((point) => ({
        label: point.label,
        value: point.diuresis,
      })),
      lines: [
        {
          dataKey: "value",
          name: "Diurèse",
          stroke: "var(--chart-2)",
          unit: "ml",
          decimals: 0,
        },
      ],
    },
  ];
}

function evolutionNoteAuthorRoleLabel(role: UserRole | undefined) {
  return role ? ROLE_LABELS[role] : "Auteur";
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

  if (event.entity === "labPanel") {
    return patientUpdateDetailWithValue(
      "Bilan biologique ajoute",
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

function PatientTabMotion({
  children,
  direction,
}: {
  children: ReactNode;
  direction: "forward" | "backward";
}) {
  return (
    <motion.div
      className="col-start-1 row-start-1 min-w-0 text-sm outline-none"
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
  return !["summary", "entrance"].includes(tab);
}
