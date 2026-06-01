import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import {
  Activity,
  Archive,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  FlaskConical,
  Pencil,
  Plus,
  Save,
  Stethoscope,
  Thermometer,
  Trash2,
  XCircle,
} from "lucide-react"
import { Navigate, useNavigate, useParams } from "react-router"

import {
  addEvolutionNote,
  addLabResult,
  addMedicalDocument,
  addPrescription,
  addVitalRecord,
  archivePatient,
  deleteVitalRecord,
  downloadMedicalDocument,
  getLatestVitalRecord,
  getPatient,
  listEvolutionNotes,
  listLabResults,
  listMedicalDocuments,
  listPrescriptions,
  listVitalRecords,
  openMedicalDocument,
  setRealtimeContext,
  subscribeRealtime,
  type RealtimeEvent,
  updatePatient,
  updatePrescriptionStatus,
  updateVitalRecord,
} from "@/api"
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  LAB_STATUSES,
  PATIENT_TAB_VALUES,
  PATIENT_TABS,
  PRESCRIPTION_STATUSES,
} from "@/app/constants"
import {
  dateInput,
  formatDate,
  formatEvolutionNoteDay,
  formatEvolutionNoteMonth,
  formatEvolutionNoteTime,
  formatShortDateTime,
} from "@/app/date-utils"
import { errorMessage } from "@/app/error-utils"
import { filenameFromDisposition, readFileAsDataUrl } from "@/app/file-utils"
import {
  emptyDocumentForm,
  emptyEvolutionForm,
  emptyLabForm,
  emptyPatientForm,
  emptyPrescriptionFilters,
  emptyPrescriptionForm,
  emptyVitalForm,
  patientToForm,
  prescriptionEndDateFromDuration,
  trimPrescriptionMedicationForm,
  vitalFormToInput,
  vitalRecordToForm,
} from "@/app/form-state"
import {
  bedLabel,
  formatFileSize,
  nullableOptionalValue,
  optionalValue,
  patientSexLabel,
  prescriptionStatusLabel,
  textIncludes,
} from "@/app/formatters"
import {
  emptyLabMarkerRangeFilter,
  formatLabPanelPreview,
  hasLabMarkerRangeFilter,
  labFormResultsToInput,
  labStatusLabel,
  parseLabNumericValue,
  parseOptionalNumberFilter,
  worstLabStatus,
} from "@/app/lab-utils"
import { realtimePageForPatientTab } from "@/app/realtime"
import type {
  DocumentFormState,
  EvolutionFormState,
  LabFormState,
  LabMarkerRangeFilter,
  PatientFormState,
  PatientTab,
  PrescriptionFilters,
  PrescriptionFormState,
  VitalChartPanel,
  VitalFormState,
} from "@/app/types"
import {
  ClinicalValue,
  MedicalColumnHead,
  MetricTile,
  PatientInfoBadge,
} from "@/components/common/Display"
import { AlertMessage, EmptyState, StatusBadge } from "@/components/common/Feedback"
import { Field } from "@/components/common/Field"
import { DateTextInput, DateTimeTextInput } from "@/components/common/DateInputs"
import { NumberField, ServiceSelect } from "@/components/common/FormControls"
import { LoadingScreen } from "@/components/common/LoadingScreen"
import { SectionTitle } from "@/components/common/SectionTitle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
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
import { LabPanelDetailsDialog } from "@/features/labs/components/LabPanelDetailsDialog"
import { LabPanelDialog } from "@/features/labs/components/LabPanelDialog"
import { PatientFormFields } from "./PatientFormFields"
import { PrescriptionForm } from "@/features/prescriptions/components/PrescriptionForm"
import { VitalMeasureChart } from "@/features/vitals/components/VitalMeasureChart"
import { cn } from "@/lib/utils"
import { LAB_PANEL_TYPES, labPanelDefinition } from "@/types"
import type {
  Account,
  Bed,
  EvolutionNote,
  LabPanel,
  LabPanelType,
  MedicalDocument,
  MedicalDocumentCategory,
  Patient,
  PatientSex,
  Prescription,
  Service,
  VitalRecord,
} from "@/types"

export function PatientWorkspace({
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
  const navigate = useNavigate()
  const { tab } = useParams()
  const activeTabFromRoute = isPatientTab(tab) ? tab : null
  const activeTab = activeTabFromRoute ?? "summary"
  const activeTabIndex = PATIENT_TAB_VALUES.indexOf(activeTab)
  const previousTabIndexRef = useRef(activeTabIndex)
  const [tabDirection, setTabDirection] = useState<"forward" | "backward">(
    "forward"
  )
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
  const [evolutionDraftOpen, setEvolutionDraftOpen] = useState(false)
  const [hasEvolutionDraft, setHasEvolutionDraft] = useState(false)
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

  useEffect(() => {
    const previousTabIndex = previousTabIndexRef.current

    if (previousTabIndex !== activeTabIndex) {
      setTabDirection(
        activeTabIndex > previousTabIndex ? "forward" : "backward"
      )
      previousTabIndexRef.current = activeTabIndex
    }
  }, [activeTabIndex])

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
    setEditingVitalId(null)
    setVitalForm(emptyVitalForm())
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

        if (medicationInputs.some((medication) => !medication.medicineId)) {
          throw new Error("Selectionnez un medicament reference pour chaque ligne")
        }

        await Promise.all(
          medicationInputs.map((medication) => {
            const prescriptionEndDate = prescriptionEndDateFromDuration(
              prescriptionForm.startDate,
              medication.durationValue,
              medication.durationUnit
            )

            return addPrescription(patientId, {
              medicineId: medication.medicineId,
              dosage: medication.dosage,
              frequency: medication.frequency,
              route: medication.route,
              startDate: prescriptionForm.startDate,
              endDate: prescriptionEndDate,
              status: prescriptionForm.status,
            })
          })
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
      setHasEvolutionDraft(false)
      setEvolutionDraftOpen(false)
      await loadWorkspace()
    }, "Note d'evolution ajoutee")
  }

  function handleStartEvolutionDraft() {
    setEvolutionForm((current) => ({
      ...(hasEvolutionDraft ? current : emptyEvolutionForm(currentAccount)),
      service: patient?.currentService ?? current.service,
    }))
    setHasEvolutionDraft(true)
    setEvolutionDraftOpen(true)
  }

  function handleTabChange(value: string) {
    const nextTab = value as PatientTab

    if (nextTab === activeTab) {
      return
    }

    const nextTabIndex = PATIENT_TAB_VALUES.indexOf(nextTab)
    const direction = nextTabIndex > activeTabIndex ? "forward" : "backward"
    setTabDirection(direction)
    document.documentElement.dataset.patientTabDirection = direction

    const navigateToTab = () => navigate(`/patients/${patientId}/${nextTab}`)
    const startViewTransition =
      "startViewTransition" in document
        ? () =>
            (
              document as Document & {
                startViewTransition: (callback: () => void) => void
              }
            ).startViewTransition(navigateToTab)
        : null

    if (startViewTransition) {
      startViewTransition()
    } else {
      navigateToTab()
    }

    window.setTimeout(() => {
      delete document.documentElement.dataset.patientTabDirection
    }, 360)
  }

  const tabPanelClassName = cn(
    "patient-tab-panel",
    tabDirection === "forward"
      ? "patient-tab-panel-forward"
      : "patient-tab-panel-backward"
  )

  if (!tab || !activeTabFromRoute) {
    return <Navigate to={`/patients/${patientId}/summary`} replace />
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
        onValueChange={handleTabChange}
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

        <TabsContent className={tabPanelClassName} value="summary">
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

        <TabsContent className={tabPanelClassName} value="vitals">
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

        <TabsContent className={tabPanelClassName} value="prescriptions">
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
                      <TableHead>Debut</TableHead>
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
                  onChange={setPrescriptionForm}
                  onSubmit={handleAddPrescription}
                  onCancel={() => setPrescriptionDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </section>
        </TabsContent>

        <TabsContent className={tabPanelClassName} value="labs">
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

        <TabsContent className={tabPanelClassName} value="documents">
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

        <TabsContent className={tabPanelClassName} value="evolution">
          {evolutionDraftOpen ? (
            <form
              className="grid gap-4 rounded-lg border bg-background p-4"
              onSubmit={handleAddEvolution}
            >
              <SectionTitle
                icon={Activity}
                title="Nouvelle note d'evolution"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEvolutionDraftOpen(false)}
                  >
                    <FileText className="size-4" />
                    Notes
                  </Button>
                }
              />
              <div className="grid gap-2 sm:grid-cols-2">
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
                  className="min-h-72"
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
            <section className="rounded-lg border bg-background p-4">
              <SectionTitle icon={Activity} title="Evolution clinique" />
              <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
                <button
                  type="button"
                  className="group grid aspect-square min-h-56 place-items-center rounded-lg border border-dashed bg-card p-4 text-center text-primary shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function isPatientTab(value: string | undefined): value is PatientTab {
  return PATIENT_TAB_VALUES.includes(value as PatientTab)
}
