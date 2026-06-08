import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import type { Types } from "@cornerstonejs/core";
import type { Types as ToolTypes } from "@cornerstonejs/tools";
import type {
  DataSet as DicomDataSet,
  Element as DicomElement,
} from "dicom-parser";

import { downloadMedicalDocumentBlob } from "@/api";
import { errorMessage } from "@/app/error-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { MedicalDocument } from "@/types";

type CornerstoneCoreModule = typeof import("@cornerstonejs/core");
type CornerstoneToolsModule = typeof import("@cornerstonejs/tools");
type DicomParserModule = typeof import("dicom-parser");

type CornerstoneModules = {
  core: CornerstoneCoreModule;
  tools: CornerstoneToolsModule;
};
type DicomToolGroup = NonNullable<
  ReturnType<CornerstoneToolsModule["ToolGroupManager"]["createToolGroup"]>
>;
type ActivePrimaryTool = "slice" | "window" | "arrow";
type WindowPresetId = "abdomen" | "lung" | "bone";
type WindowPreset = {
  center: number;
  id: WindowPresetId;
  label: string;
  width: number;
};
type SliceNavigation = {
  axis: "horizontal" | "vertical";
  label: string;
};
type ViewControlState = {
  panX: number;
  panY: number;
  windowCenter: number;
  windowWidth: number;
  zoom: number;
};
type ControlRanges = {
  pan: { min: number; max: number };
  windowCenter: { min: number; max: number };
  windowWidth: { min: number; max: number };
  zoom: { min: number; max: number };
};
type ArrowAnnotation = {
  data: ToolTypes.Annotation["data"] & { label?: string };
} & ToolTypes.Annotation;

type ScalarPixelData = Uint8Array | Uint16Array | Int16Array | Float32Array;
type ScalarPixelDataType =
  | "Uint8Array"
  | "Uint16Array"
  | "Int16Array"
  | "Float32Array";

type ParsedDicomImage = {
  columns: number;
  frameOfReferenceUID: string;
  imageOrientationPatient: number[];
  imagePositionPatient: [number, number, number];
  instanceNumber?: number;
  maxPixelValue: number;
  minPixelValue: number;
  modality: string;
  photometricInterpretation: string;
  pixelData: ScalarPixelData;
  rowPixelSpacing: number;
  columnPixelSpacing: number;
  rows: number;
  pixelRepresentation: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  sliceLocation?: number;
  sliceSortPosition?: number;
  sourceName: string;
  windowCenter: number;
  windowWidth: number;
};

let cornerstoneLibrariesReady: Promise<CornerstoneModules> | null = null;
let cornerstoneToolsRegistered = false;

const WINDOW_PRESETS: WindowPreset[] = [
  { center: 40, id: "abdomen", label: "Abdominale", width: 400 },
  { center: -600, id: "lung", label: "Pulmonaire", width: 1500 },
  { center: 300, id: "bone", label: "Osseuse", width: 2000 },
];
const DEFAULT_ARROW_COLOR = "#facc15";
const ARROW_COLOR_OPTIONS = [
  "#facc15",
  "#ef4444",
  "#f97316",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
  "#94a3b8",
  "#111827",
  "#000000",
];
const DEFAULT_CONTROL_RANGES: ControlRanges = {
  pan: { min: -1000, max: 1000 },
  windowCenter: { min: -1024, max: 3071 },
  windowWidth: { min: 1, max: 4095 },
  zoom: { min: 0.25, max: 8 },
};
const INITIAL_VIEW_CONTROLS: ViewControlState = {
  panX: 0,
  panY: 0,
  windowCenter: 0,
  windowWidth: 1,
  zoom: 1,
};
const DEFAULT_SLICE_NAVIGATION: SliceNavigation = {
  axis: "horizontal",
  label: "Axiale",
};
const SLICE_DRAG_PIXELS_PER_STEP = 20;

function ensureCornerstoneReady() {
  cornerstoneLibrariesReady ??= Promise.all([
    import("@cornerstonejs/core"),
    import("@cornerstonejs/tools"),
  ]).then(([core, tools]) => {
    if (!core.isCornerstoneInitialized()) {
      core.init();
    }

    core.setUseCPURendering(true);
    tools.init();

    if (!cornerstoneToolsRegistered) {
      tools.addTool(tools.WindowLevelTool);
      tools.addTool(tools.ZoomTool);
      tools.addTool(tools.PanTool);
      tools.addTool(tools.StackScrollTool);
      tools.addTool(tools.ArrowAnnotateTool);
      cornerstoneToolsRegistered = true;
    }

    return { core, tools };
  });

  return cornerstoneLibrariesReady;
}

export function DicomImageViewerDialog({
  document,
  open,
  onOpenChange,
}: {
  document: MedicalDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewportRef = useRef<Types.IStackViewport | null>(null);
  const toolGroupRef = useRef<DicomToolGroup | null>(null);
  const toolsRef = useRef<CornerstoneToolsModule | null>(null);
  const activePrimaryToolRef = useRef<ActivePrimaryTool>("slice");
  const selectedArrowColorRef = useRef(DEFAULT_ARROW_COLOR);
  const [viewportElement, setViewportElement] =
    useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [ready, setReady] = useState(false);
  const [sliceIndex, setSliceIndex] = useState(0);
  const [sliceCount, setSliceCount] = useState(0);
  const [sliceNavigation, setSliceNavigation] = useState<SliceNavigation>(
    DEFAULT_SLICE_NAVIGATION,
  );
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);
  const [activePrimaryTool, setActivePrimaryTool] =
    useState<ActivePrimaryTool>("slice");
  const [activeWindowPresetId, setActiveWindowPresetId] = useState<
    WindowPresetId | ""
  >("");
  const [controlRanges, setControlRanges] = useState<ControlRanges>(
    DEFAULT_CONTROL_RANGES,
  );
  const [viewControls, setViewControls] = useState<ViewControlState>(
    INITIAL_VIEW_CONTROLS,
  );
  const [selectedArrowUid, setSelectedArrowUid] = useState("");
  const [selectedArrowLabel, setSelectedArrowLabel] = useState("");
  const [selectedArrowColor, setSelectedArrowColor] =
    useState(DEFAULT_ARROW_COLOR);
  const handleViewportElementRef = useCallback(
    (element: HTMLDivElement | null) => setViewportElement(element),
    [],
  );

  useEffect(() => {
    const selectedDocument = document;

    if (!open || !selectedDocument || !viewportElement) {
      return;
    }

    let cancelled = false;
    let cornerstoneModules: CornerstoneModules | null = null;
    let renderingEngine: InstanceType<
      CornerstoneCoreModule["RenderingEngine"]
    > | null = null;
    let imageIds: string[] = [];
    let toolGroupId: string | null = null;
    let removeCtrlWheelZoomListener: (() => void) | null = null;
    let removePrimarySliceDragListener: (() => void) | null = null;
    let removeStackListeners: (() => void) | null = null;
    let removeArrowAnnotationListeners: (() => void) | null = null;
    let removeViewControlListeners: (() => void) | null = null;

    async function renderDocumentImage(
      selectedDocument: MedicalDocument,
      viewportElement: HTMLDivElement,
    ) {
      setLoading(true);
      setReady(false);
      setViewerError("");
      setSliceIndex(0);
      setSliceCount(0);
      setSliceNavigation(DEFAULT_SLICE_NAVIGATION);
      activePrimaryToolRef.current = "slice";
      setActivePrimaryTool("slice");
      setActiveWindowPresetId("");
      setControlRanges(DEFAULT_CONTROL_RANGES);
      setViewControls(INITIAL_VIEW_CONTROLS);
      setSelectedArrowUid("");
      setSelectedArrowLabel("");
      setSelectedArrowColor(DEFAULT_ARROW_COLOR);
      selectedArrowColorRef.current = DEFAULT_ARROW_COLOR;
      viewportRef.current = null;
      toolGroupRef.current = null;
      toolsRef.current = null;

      try {
        const blob = await downloadMedicalDocumentBlob(selectedDocument.id);

        if (cancelled) {
          return;
        }

        const parsedDicomSeries = await parseDicomSeriesBlob(
          selectedDocument,
          blob,
        );

        if (cancelled) {
          return;
        }

        cornerstoneModules = await ensureCornerstoneReady();
        const { core, tools } = cornerstoneModules;
        imageIds = parsedDicomSeries.map((parsedDicom, index) =>
          createCornerstoneLocalDicomImage(
            core,
            `${selectedDocument.id}-${index}`,
            parsedDicom,
          ),
        );
        const initialImageIndex = Math.floor((imageIds.length - 1) / 2);
        const initialSliceNavigation = getSliceNavigation(
          parsedDicomSeries[initialImageIndex],
        );
        setSliceNavigation(initialSliceNavigation);
        const renderingEngineId = `document-dicom-engine-${selectedDocument.id}`;
        const viewportId = `document-dicom-viewport-${selectedDocument.id}`;
        renderingEngine = new core.RenderingEngine(renderingEngineId);

        renderingEngine.enableElement({
          element: viewportElement,
          viewportId,
          type: core.Enums.ViewportType.STACK,
        });

        const viewport = renderingEngine.getStackViewport(viewportId);
        await viewport.setStack(imageIds, initialImageIndex);
        renderingEngine.resize(true, false);
        viewport.resetCamera();
        applyInitialWindowLevel(viewport);
        viewport.render();
        setControlRanges(getControlRanges(viewport));
        setViewControls(readViewControls(viewport));

        if (cancelled) {
          return;
        }

        setSliceCount(imageIds.length);
        setSliceIndex(initialImageIndex + 1);
        toolGroupId = `document-dicom-tools-${selectedDocument.id}`;
        const toolGroup = tools.ToolGroupManager.createToolGroup(toolGroupId);

        if (!toolGroup) {
          throw new Error("Initialisation des outils d'imagerie impossible");
        }

        toolGroup.addTool(tools.WindowLevelTool.toolName);
        toolGroup.addTool(tools.ZoomTool.toolName);
        toolGroup.addTool(tools.PanTool.toolName);
        toolGroup.addTool(tools.StackScrollTool.toolName);
        toolGroup.addTool(tools.ArrowAnnotateTool.toolName, {
          changeTextCallback: (
            _annotation: unknown,
            _eventData: unknown,
            doneChangingTextCallback: (label: string) => void,
          ) => doneChangingTextCallback(""),
          getTextCallback: (
            doneChangingTextCallback: (label: string) => void,
          ) => doneChangingTextCallback("Fleche"),
        });
        toolGroup.addViewport(viewportId, renderingEngineId);
        toolGroup.setToolActive(tools.PanTool.toolName, {
          bindings: [{ mouseButton: tools.Enums.MouseBindings.Auxiliary }],
        });
        toolGroup.setToolActive(tools.StackScrollTool.toolName, {
          bindings: [{ mouseButton: tools.Enums.MouseBindings.Wheel }],
        });

        viewportRef.current = viewport;
        toolGroupRef.current = toolGroup;
        toolsRef.current = tools;
        removePrimarySliceDragListener = attachPrimarySliceDragListener(
          viewport,
          viewportElement,
          {
            axis: initialSliceNavigation.axis,
            getActivePrimaryTool: () => activePrimaryToolRef.current,
            setCurrentSliceIndex: setSliceIndex,
            setViewerError: (dragError) => setViewerError(errorMessage(dragError)),
            sliceCount: imageIds.length,
          },
        );
        removeStackListeners = attachStackIndexListener(
          core,
          viewport,
          viewportElement,
          setSliceIndex,
        );
        removeCtrlWheelZoomListener = attachCtrlWheelZoomListener(
          viewport,
          viewportElement,
          setViewControls,
        );
        removeArrowAnnotationListeners = attachArrowAnnotationListeners(
          core,
          tools,
          viewport,
          {
            getDefaultColor: () => selectedArrowColorRef.current,
            setSelectedArrowColor: (color) => {
              selectedArrowColorRef.current = color;
              setSelectedArrowColor(color);
            },
            setSelectedArrowLabel,
            setSelectedArrowUid,
          },
        );
        removeViewControlListeners = attachViewControlListeners(
          core,
          viewport,
          setViewControls,
        );
        setReady(true);
      } catch (renderError) {
        if (!cancelled) {
          console.error("DicomImageViewerDialog render error", renderError);
          setViewerError(errorMessage(renderError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void renderDocumentImage(selectedDocument, viewportElement);

    return () => {
      cancelled = true;
      viewportRef.current = null;
      toolGroupRef.current = null;
      toolsRef.current = null;
      setSliceIndex(0);
      setSliceCount(0);
      setSliceNavigation(DEFAULT_SLICE_NAVIGATION);
      removeCtrlWheelZoomListener?.();
      removePrimarySliceDragListener?.();
      removeStackListeners?.();
      removeArrowAnnotationListeners?.();
      removeViewControlListeners?.();

      if (toolGroupId) {
        cornerstoneModules?.tools.ToolGroupManager.destroyToolGroup(
          toolGroupId,
        );
      }

      if (renderingEngine) {
        renderingEngine.destroy();
      }

      for (const cachedImageId of imageIds) {
        cornerstoneModules?.core.cache.removeImageLoadObject(cachedImageId, {
          force: true,
        });
      }
    };
  }, [document, open, viewportElement]);

  function resetCamera() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.resetCamera();
    viewport.render();
    setViewControls(readViewControls(viewport));
  }

  function resetViewControls() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.resetCamera();
    applyInitialWindowLevel(viewport);
    viewport.render();
    setActiveWindowPresetId("");
    setViewControls(readViewControls(viewport));
  }

  function handleSliceChange(event: ChangeEvent<HTMLInputElement>) {
    setViewportSlice(Number(event.currentTarget.value));
  }

  function stepSlice(delta: number) {
    setViewportSlice(sliceIndex + delta);
  }

  function setViewportSlice(nextSliceIndex: number) {
    const viewport = viewportRef.current;

    if (!viewport || !Number.isFinite(nextSliceIndex) || sliceCount === 0) {
      return;
    }

    const clampedSliceIndex = Math.min(
      Math.max(Math.round(nextSliceIndex), 1),
      sliceCount,
    );

    setSliceIndex(clampedSliceIndex);
    void viewport
      .setImageIdIndex(clampedSliceIndex - 1)
      .then(() => {
        viewport.render();
      })
      .catch((sliceError: unknown) => {
        setViewerError(errorMessage(sliceError));
      });
  }

  function setPrimaryTool(nextTool: ActivePrimaryTool) {
    const toolGroup = toolGroupRef.current;
    const tools = toolsRef.current;

    if (!toolGroup || !tools) {
      return;
    }

    const primaryBinding = {
      bindings: [{ mouseButton: tools.Enums.MouseBindings.Primary }],
    };

    toolGroup.setToolPassive(tools.WindowLevelTool.toolName, {
      removeAllBindings: true,
    });
    toolGroup.setToolPassive(tools.ArrowAnnotateTool.toolName, {
      removeAllBindings: true,
    });

    if (nextTool === "arrow") {
      toolGroup.setToolActive(
        tools.ArrowAnnotateTool.toolName,
        primaryBinding,
      );
    } else if (nextTool === "window") {
      toolGroup.setToolActive(tools.WindowLevelTool.toolName, primaryBinding);
    }

    activePrimaryToolRef.current = nextTool;
    setActivePrimaryTool(nextTool);
  }

  function toggleWindowTool() {
    setPrimaryTool(activePrimaryTool === "window" ? "slice" : "window");
  }

  function toggleArrowTool() {
    setPrimaryTool(activePrimaryTool === "arrow" ? "slice" : "arrow");
  }

  function applyWindowPreset(presetId: string) {
    const viewport = viewportRef.current;
    const preset = WINDOW_PRESETS.find((preset) => preset.id === presetId);

    if (!viewport || !preset) {
      return;
    }

    viewport.setProperties({
      voiRange: windowPresetToVoiRange(preset),
      invert: false,
    });
    viewport.render();
    setActiveWindowPresetId(preset.id);
  }

  function updateWindowCenter(event: ChangeEvent<HTMLInputElement>) {
    const windowCenter = Number(event.currentTarget.value);

    if (!Number.isFinite(windowCenter)) {
      return;
    }

    applyWindowControls({ windowCenter });
  }

  function updateWindowWidth(event: ChangeEvent<HTMLInputElement>) {
    const windowWidth = Number(event.currentTarget.value);

    if (!Number.isFinite(windowWidth)) {
      return;
    }

    applyWindowControls({ windowWidth });
  }

  function applyWindowControls(
    partialControls: Partial<Pick<ViewControlState, "windowCenter" | "windowWidth">>,
  ) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const nextControls = {
      ...viewControls,
      ...partialControls,
    };
    const windowWidth = Math.max(1, nextControls.windowWidth);

    viewport.setProperties({
      voiRange: windowLevelToVoiRange(nextControls.windowCenter, windowWidth),
      invert: false,
    });
    viewport.render();
    setActiveWindowPresetId("");
    setViewControls(readViewControls(viewport));
  }

  function updateZoom(event: ChangeEvent<HTMLInputElement>) {
    const viewport = viewportRef.current;
    const zoom = Number(event.currentTarget.value);

    if (!viewport || !Number.isFinite(zoom)) {
      return;
    }

    viewport.setZoom(zoom);
    viewport.render();
    setViewControls(readViewControls(viewport));
  }

  function updatePan(axis: "x" | "y", value: number) {
    const viewport = viewportRef.current;

    if (!viewport || !Number.isFinite(value)) {
      return;
    }

    const nextControls = {
      ...viewControls,
      ...(axis === "x" ? { panX: value } : { panY: value }),
    };
    const nextPan: Types.Point2 =
      axis === "x"
        ? [value, viewControls.panY]
        : [viewControls.panX, value];

    viewport.setPan(nextPan);
    viewport.render();
    setViewControls(nextControls);
  }

  function updateArrowLabel(event: ChangeEvent<HTMLInputElement>) {
    const label = event.currentTarget.value;
    setSelectedArrowLabel(label);
    updateSelectedArrow({ label });
  }

  function updateArrowColor(color: string) {
    selectedArrowColorRef.current = color;
    setSelectedArrowColor(color);
    updateSelectedArrow({ color });
  }

  function updateSelectedArrow({
    color,
    label,
  }: {
    color?: string;
    label?: string;
  }) {
    const viewport = viewportRef.current;
    const tools = toolsRef.current;

    if (!viewport || !tools || !selectedArrowUid) {
      return;
    }

    const annotation = tools.annotation.state.getAnnotation(
      selectedArrowUid,
    ) as ArrowAnnotation | undefined;

    if (!annotation) {
      return;
    }

    if (typeof label === "string") {
      annotation.data.label = label;
    }

    if (color) {
      applyArrowAnnotationColor(tools, annotation, color);
    }

    tools.annotation.state.triggerAnnotationModified(
      annotation,
      viewport.element,
    );
    tools.utilities.triggerAnnotationRenderForViewportIds([viewport.id]);
  }

  async function downloadCurrentImagePng() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    try {
      const pngBlob = await renderViewportPng(viewport);
      const url = URL.createObjectURL(pngBlob);
      const anchor = window.document.createElement("a");

      anchor.href = url;
      anchor.download = `${sanitizeFilename(documentTitle)}-coupe-${sliceIndex || 1}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setViewerError(errorMessage(downloadError));
    }
  }

  const documentTitle = document?.title ?? "Imagerie scanner";
  const viewerDialogStyle = {
    width: "calc(100vw - 1rem)",
    maxWidth: "calc(100vw - 1rem)",
    height: "calc(100vh - 1rem)",
    maxHeight: "calc(100vh - 1rem)",
  };
  const isVerticalSliceNavigation = sliceNavigation.axis === "vertical";
  const sliceNavigator =
    sliceCount > 1 ? (
      <div
        className={cn(
          "text-xs text-muted-foreground",
          isVerticalSliceNavigation
            ? "flex h-full min-h-0 w-24 flex-col items-center gap-3"
            : "flex flex-wrap items-center gap-3",
        )}
      >
        <span
          className={cn(
            "font-medium text-foreground",
            isVerticalSliceNavigation ? "text-center" : "min-w-24",
          )}
        >
          {sliceNavigation.label}
          <span className="block">
            Coupe {sliceIndex} / {sliceCount}
          </span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!ready || sliceIndex <= 1}
          onClick={() => stepSlice(-1)}
          aria-label="Coupe precedente"
        >
          {isVerticalSliceNavigation ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
        <input
          type="range"
          min={1}
          max={sliceCount}
          step={1}
          value={sliceIndex || 1}
          disabled={!ready}
          onChange={handleSliceChange}
          onInput={(event) =>
            setViewportSlice(Number(event.currentTarget.value))
          }
          className={cn(
            "accent-primary",
            isVerticalSliceNavigation ? "min-h-64 flex-1" : "h-2 min-w-64 flex-1",
          )}
          style={
            isVerticalSliceNavigation
              ? {
                  direction: "rtl",
                  writingMode: "vertical-lr",
                }
              : undefined
          }
          aria-label="Coupe DICOM"
          aria-orientation={
            isVerticalSliceNavigation ? "vertical" : "horizontal"
          }
        />
        <input
          type="number"
          min={1}
          max={sliceCount}
          step={1}
          value={sliceIndex || 1}
          disabled={!ready}
          onChange={handleSliceChange}
          className="h-8 w-20 rounded-md border bg-background px-2 text-right text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          aria-label="Numero de coupe DICOM"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!ready || sliceIndex >= sliceCount}
          onClick={() => stepSlice(1)}
          aria-label="Coupe suivante"
        >
          {isVerticalSliceNavigation ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid !max-w-none grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-0"
        style={viewerDialogStyle}
      >
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
            <div className="grid gap-1">
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="size-5" />
                {documentTitle}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Zoom: Ctrl + molette.</span>
                <span>Clic gauche + glisser: changer de coupe.</span>
                <span>Deplacement canvas: bouton central + glisser.</span>
                <span>Valeurs: drag centre/largeur.</span>
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!ready}
              onClick={resetCamera}
            >
              <RotateCcw className="size-4" />
              Reinitialiser
            </Button>
          </div>
        </DialogHeader>
        <div
          className={cn(
            "grid min-h-0 gap-3 px-5 pb-5",
            isVerticalSliceNavigation
              ? "grid-cols-[auto_minmax(0,1fr)]"
              : "grid-rows-[minmax(0,1fr)_auto]",
          )}
        >
          {isVerticalSliceNavigation && sliceNavigator}
          <div
            className={cn(
              "relative h-full min-h-0 overflow-hidden rounded-xl border bg-black",
              viewerError && "grid place-items-center",
            )}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div ref={handleViewportElementRef} className="absolute inset-0" />
            <div className="absolute top-3 right-3 z-20 w-[min(20rem,calc(100%-1.5rem))] rounded-lg border border-white/15 bg-background/95 p-3 text-foreground shadow-xl backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Outils</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={
                    toolsPanelOpen ? "Masquer les outils" : "Afficher les outils"
                  }
                  title={
                    toolsPanelOpen ? "Masquer les outils" : "Afficher les outils"
                  }
                  onClick={() => setToolsPanelOpen((open) => !open)}
                >
                  {toolsPanelOpen ? (
                    <PanelRightClose className="size-3" />
                  ) : (
                    <PanelRightOpen className="size-3" />
                  )}
                </Button>
              </div>
              {toolsPanelOpen && (
                <div className="mt-3 grid gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!ready}
                    onClick={downloadCurrentImagePng}
                    className="justify-start"
                  >
                    <Download className="size-4" />
                    PNG
                  </Button>
                  <Button
                    type="button"
                    variant={activePrimaryTool === "window" ? "default" : "outline"}
                    size="sm"
                    disabled={!ready}
                    aria-pressed={activePrimaryTool === "window"}
                    onClick={toggleWindowTool}
                    className="justify-start"
                  >
                    <SlidersHorizontal className="size-4" />
                    Valeurs
                  </Button>
                  <Button
                    type="button"
                    variant={activePrimaryTool === "arrow" ? "default" : "outline"}
                    size="sm"
                    disabled={!ready}
                    aria-pressed={activePrimaryTool === "arrow"}
                    onClick={toggleArrowTool}
                    className="justify-start"
                  >
                    <ArrowUpRight className="size-4" />
                    Fleche
                  </Button>
                  <div className="grid gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Fleche selectionnee
                    </p>
                    <input
                      type="text"
                      value={selectedArrowLabel}
                      disabled={!selectedArrowUid}
                      onChange={updateArrowLabel}
                      placeholder="Selectionner une fleche"
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    />
                    <ColorSelect
                      disabled={!ready}
                      onChange={updateArrowColor}
                      value={selectedArrowColor}
                    />
                  </div>
                  <div className="grid gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Fenetres
                    </p>
                    <ToggleGroup
                      type="single"
                      value={activeWindowPresetId}
                      onValueChange={applyWindowPreset}
                      aria-label="Fenetres scanner"
                      className="grid w-full grid-cols-3 rounded-lg"
                    >
                      {WINDOW_PRESETS.map((preset) => (
                        <ToggleGroupItem
                          key={preset.id}
                          value={preset.id}
                          disabled={!ready}
                          className="h-8 rounded-md px-2 text-xs"
                        >
                          {preset.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!ready}
                      onClick={resetViewControls}
                      className="justify-start"
                    >
                      <RotateCcw className="size-4" />
                      Reset vue
                    </Button>
                    <ControlSlider
                      label="Centre"
                      max={controlRanges.windowCenter.max}
                      min={controlRanges.windowCenter.min}
                      onChange={updateWindowCenter}
                      step={1}
                      value={viewControls.windowCenter}
                    />
                    <ControlSlider
                      label="Largeur"
                      max={controlRanges.windowWidth.max}
                      min={controlRanges.windowWidth.min}
                      onChange={updateWindowWidth}
                      step={1}
                      value={viewControls.windowWidth}
                    />
                    <ControlSlider
                      label="Zoom"
                      max={controlRanges.zoom.max}
                      min={controlRanges.zoom.min}
                      onChange={updateZoom}
                      step={0.05}
                      value={viewControls.zoom}
                      valueFormatter={(value) => `${value.toFixed(2)}x`}
                    />
                    <ControlSlider
                      label="Pan X"
                      max={controlRanges.pan.max}
                      min={controlRanges.pan.min}
                      onChange={(event) =>
                        updatePan("x", Number(event.currentTarget.value))
                      }
                      step={1}
                      value={viewControls.panX}
                    />
                    <ControlSlider
                      label="Pan Y"
                      max={controlRanges.pan.max}
                      min={controlRanges.pan.min}
                      onChange={(event) =>
                        updatePan("y", Number(event.currentTarget.value))
                      }
                      step={1}
                      value={viewControls.panY}
                    />
                  </div>
                </div>
              )}
            </div>
            {loading && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black/80 text-sm text-white">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Chargement de l'image DICOM
                </span>
              </div>
            )}
            {viewerError && !loading && (
              <div className="max-w-md px-6 text-center text-sm text-white">
                <p className="font-medium">Visualisation impossible</p>
                <p className="mt-2 text-white/70">{viewerError}</p>
              </div>
            )}
          </div>
          {!isVerticalSliceNavigation && sliceNavigator}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ControlSlider({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueFormatter,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  step: number;
  value: number;
  valueFormatter?: (value: number) => string;
}) {
  const safeValue = Number.isFinite(value) ? value : min;
  const displayedValue = valueFormatter
    ? valueFormatter(safeValue)
    : Number.isInteger(step)
      ? Math.round(safeValue).toString()
      : safeValue.toFixed(2);

  return (
    <label className="grid gap-1">
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{displayedValue}</span>
      </span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={onChange}
          onInput={(event) =>
            onChange(event as unknown as ChangeEvent<HTMLInputElement>)
          }
          className="h-2 min-w-0 flex-1 accent-primary"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isInteger(step) ? Math.round(safeValue) : safeValue}
          onChange={onChange}
          className="h-7 w-20 rounded-md border bg-background px-2 text-right font-mono text-xs text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    </label>
  );
}

function ColorSelect({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (color: string) => void;
  value: string;
}) {
  const selectedColor = ARROW_COLOR_OPTIONS.includes(value)
    ? value
    : DEFAULT_ARROW_COLOR;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="justify-start"
          aria-label="Couleur de la fleche"
        >
          <span
            className="size-4 rounded-full border border-border"
            style={{ backgroundColor: selectedColor }}
            aria-hidden="true"
          />
          Couleur
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {selectedColor.toUpperCase()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <div className="grid grid-cols-4 gap-2">
          {ARROW_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "grid size-9 place-items-center rounded-md border border-border transition hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selectedColor === color && "ring-2 ring-primary",
              )}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
              aria-label={`Couleur ${color}`}
              aria-pressed={selectedColor === color}
            >
              {selectedColor === color && (
                <Check
                  className={cn(
                    "size-4",
                    color === "#ffffff" || color === "#facc15"
                      ? "text-black"
                      : "text-white",
                  )}
                />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function parseDicomSeriesBlob(
  document: MedicalDocument,
  blob: Blob,
): Promise<ParsedDicomImage[]> {
  const dicomParser = await import("dicom-parser");

  if (isZipDocument(document)) {
    const zipModule = await import("jszip");
    const zip = await zipModule.default.loadAsync(blob);
    const entries = Object.values(zip.files).filter(
      (entry) =>
        !entry.dir &&
        !entry.name.includes("__MACOSX/") &&
        !entry.name.toLowerCase().endsWith(".txt"),
    );
    const parsedImages: ParsedDicomImage[] = [];

    for (const entry of entries) {
      try {
        const bytes = new Uint8Array(await entry.async("arraybuffer"));
        parsedImages.push(parseDicomByteArray(dicomParser, bytes, entry.name));
      } catch {
        // ZIP archives often contain citation or metadata files. Ignore files
        // that are not DICOM instances.
      }
    }

    if (parsedImages.length === 0) {
      throw new Error("Le fichier ZIP ne contient aucun DICOM lisible");
    }

    return sortDicomSeries(parsedImages);
  }

  const byteArray = new Uint8Array(await blob.arrayBuffer());
  return [
    parseDicomByteArray(
      dicomParser,
      byteArray,
      document.originalFileName ?? document.title,
    ),
  ];
}

function parseDicomByteArray(
  dicomParser: DicomParserModule,
  byteArray: Uint8Array,
  sourceName: string,
): ParsedDicomImage {
  const dataSet = dicomParser.parseDicom(byteArray);
  const transferSyntaxUID =
    dataSet.string("x00020010")?.trim() ?? "1.2.840.10008.1.2.1";

  if (!isSupportedUncompressedTransferSyntax(transferSyntaxUID)) {
    throw new Error(
      `Syntaxe DICOM compressee non prise en charge dans le viewer de test (${transferSyntaxUID})`,
    );
  }

  const rows = requireDicomUint16(dataSet, "x00280010", "Rows");
  const columns = requireDicomUint16(dataSet, "x00280011", "Columns");
  const samplesPerPixel = dataSet.uint16("x00280002") ?? 1;

  if (samplesPerPixel !== 1) {
    throw new Error("Le viewer de test accepte uniquement les DICOM monochromes");
  }

  const photometricInterpretation = (
    dataSet.string("x00280004") ?? "MONOCHROME2"
  )
    .trim()
    .toUpperCase();

  if (!photometricInterpretation.startsWith("MONOCHROME")) {
    throw new Error(
      `Interpretation photometrique non prise en charge (${photometricInterpretation})`,
    );
  }

  const bitsAllocated = dataSet.uint16("x00280100") ?? 16;
  const bitsStored = dataSet.uint16("x00280101") ?? bitsAllocated;
  const highBit = dataSet.uint16("x00280102") ?? bitsStored - 1;
  const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
  const pixelElement = dataSet.elements.x7fe00010;

  if (!pixelElement) {
    throw new Error("Aucune donnee PixelData trouvee dans le DICOM");
  }

  if (pixelElement.encapsulatedPixelData) {
    throw new Error("PixelData encapsule/compresse non pris en charge ici");
  }

  const scalarCount = rows * columns;
  const pixelData = readUncompressedPixelData({
    bitsAllocated,
    bitsStored,
    byteArray,
    highBit,
    isLittleEndian: transferSyntaxUID !== "1.2.840.10008.1.2.2",
    pixelElement,
    pixelRepresentation,
    scalarCount,
  });
  const slope = dataSet.floatString("x00281053") ?? 1;
  const intercept = dataSet.floatString("x00281052") ?? 0;
  const rescaledPixelData = applyRescale(pixelData, slope, intercept);
  const { min, max } = getMinMax(rescaledPixelData);
  const windowCenter = dataSet.floatString("x00281050") ?? (min + max) / 2;
  const windowWidth = Math.max(
    1,
    dataSet.floatString("x00281051") ?? max - min,
  );
  const rowPixelSpacing = dataSet.floatString("x00280030", 0) ?? 1;
  const columnPixelSpacing =
    dataSet.floatString("x00280030", 1) ?? rowPixelSpacing;
  const imageOrientationPatient = readDicomFloatVector(
    dataSet,
    "x00200037",
    6,
  ) ?? [1, 0, 0, 0, 1, 0];
  const imagePositionPatient = readDicomFloatTuple3(dataSet, "x00200032") ?? [
    0, 0, 0,
  ];
  const sliceLocation = dataSet.floatString("x00201041");
  const instanceNumber = dataSet.intString("x00200013");

  return {
    bitsAllocated,
    bitsStored,
    columns,
    columnPixelSpacing,
    frameOfReferenceUID:
      dataSet.string("x00200052")?.trim() ??
      `hospital-dicom-${window.crypto.randomUUID()}`,
    highBit,
    imageOrientationPatient,
    imagePositionPatient,
    instanceNumber,
    maxPixelValue: max,
    minPixelValue: min,
    modality: dataSet.string("x00080060")?.trim() || "CT",
    photometricInterpretation,
    pixelData: rescaledPixelData,
    pixelRepresentation,
    rowPixelSpacing,
    rows,
    sliceLocation,
    sliceSortPosition: getSliceSortPosition(
      imageOrientationPatient,
      imagePositionPatient,
    ),
    sourceName,
    windowCenter,
    windowWidth,
  };
}

function isZipDocument(document: MedicalDocument) {
  const mimeType = document.mimeType?.toLowerCase() ?? "";
  const fileReference = [
    document.originalFileName,
    document.storagePath,
    document.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return mimeType.includes("zip") || fileReference.includes(".zip");
}

function sortDicomSeries(images: ParsedDicomImage[]) {
  return images.toSorted((left, right) => {
    const leftPosition =
      left.sliceSortPosition ?? left.sliceLocation ?? left.instanceNumber;
    const rightPosition =
      right.sliceSortPosition ?? right.sliceLocation ?? right.instanceNumber;

    if (
      typeof leftPosition === "number" &&
      typeof rightPosition === "number" &&
      leftPosition !== rightPosition
    ) {
      return leftPosition - rightPosition;
    }

    if (
      typeof left.instanceNumber === "number" &&
      typeof right.instanceNumber === "number" &&
      left.instanceNumber !== right.instanceNumber
    ) {
      return left.instanceNumber - right.instanceNumber;
    }

    return left.sourceName.localeCompare(right.sourceName, undefined, {
      numeric: true,
    });
  });
}

function getSliceNavigation(image: ParsedDicomImage): SliceNavigation {
  const normal = getImageOrientationNormal(image.imageOrientationPatient);

  if (!normal) {
    return DEFAULT_SLICE_NAVIGATION;
  }

  const absoluteNormal = normal.map((value) => Math.abs(value));
  const dominantAxis = absoluteNormal.indexOf(Math.max(...absoluteNormal));

  if (dominantAxis === 2) {
    return { axis: "horizontal", label: "Axiale" };
  }

  if (dominantAxis === 1) {
    return { axis: "vertical", label: "Coronale" };
  }

  return { axis: "vertical", label: "Sagittale" };
}

function getSliceSortPosition(
  imageOrientationPatient: number[],
  imagePositionPatient: [number, number, number],
) {
  const normal = getImageOrientationNormal(imageOrientationPatient);

  if (!normal) {
    return undefined;
  }

  return (
    imagePositionPatient[0] * normal[0] +
    imagePositionPatient[1] * normal[1] +
    imagePositionPatient[2] * normal[2]
  );
}

function getImageOrientationNormal(imageOrientationPatient: number[]) {
  if (imageOrientationPatient.length < 6) {
    return undefined;
  }

  const row = imageOrientationPatient.slice(0, 3);
  const column = imageOrientationPatient.slice(3, 6);
  return [
    row[1] * column[2] - row[2] * column[1],
    row[2] * column[0] - row[0] * column[2],
    row[0] * column[1] - row[1] * column[0],
  ];
}

function createCornerstoneLocalDicomImage(
  core: CornerstoneCoreModule,
  documentId: string,
  parsedDicom: ParsedDicomImage,
) {
  const imageId = `hospital-dicom:${documentId}:${window.crypto.randomUUID()}`;
  const pixelDataType = getScalarPixelDataType(parsedDicom.pixelData);

  core.imageLoader.createAndCacheLocalImage(imageId, {
    scalarData: parsedDicom.pixelData as Types.PixelDataTypedArray,
    dimensions: [parsedDicom.columns, parsedDicom.rows],
    spacing: [parsedDicom.columnPixelSpacing, parsedDicom.rowPixelSpacing],
    origin: parsedDicom.imagePositionPatient,
    direction: parsedDicom.imageOrientationPatient as unknown as Types.Mat3,
    frameOfReferenceUID: parsedDicom.frameOfReferenceUID,
    targetBuffer: { type: pixelDataType },
    onCacheAdd: (image) => {
      image.windowCenter = parsedDicom.windowCenter;
      image.windowWidth = parsedDicom.windowWidth;
      image.minPixelValue = parsedDicom.minPixelValue;
      image.maxPixelValue = parsedDicom.maxPixelValue;
      image.invert = parsedDicom.photometricInterpretation === "MONOCHROME1";
      image.photometricInterpretation = parsedDicom.photometricInterpretation;
      image.voiLUTFunction = core.Enums.VOILUTFunctionType.LINEAR;
      image.dataType = pixelDataType;
    },
  });

  core.utilities.genericMetadataProvider.add(imageId, {
    type: "generalSeriesModule",
    metadata: { modality: parsedDicom.modality },
  });
  core.utilities.genericMetadataProvider.add(imageId, {
    type: "imagePixelModule",
    metadata: {
      bitsAllocated: parsedDicom.bitsAllocated,
      bitsStored: parsedDicom.bitsStored,
      columns: parsedDicom.columns,
      highBit: parsedDicom.highBit,
      modality: parsedDicom.modality,
      photometricInterpretation: parsedDicom.photometricInterpretation,
      pixelRepresentation: parsedDicom.pixelRepresentation,
      rows: parsedDicom.rows,
      samplesPerPixel: 1,
      voiLUTFunction: core.Enums.VOILUTFunctionType.LINEAR,
      windowCenter: parsedDicom.windowCenter,
      windowWidth: parsedDicom.windowWidth,
    },
  });

  return imageId;
}

function isSupportedUncompressedTransferSyntax(transferSyntaxUID: string) {
  return [
    "1.2.840.10008.1.2",
    "1.2.840.10008.1.2.1",
    "1.2.840.10008.1.2.1.99",
    "1.2.840.10008.1.2.2",
  ].includes(transferSyntaxUID);
}

function readUncompressedPixelData({
  bitsAllocated,
  bitsStored,
  byteArray,
  highBit,
  isLittleEndian,
  pixelElement,
  pixelRepresentation,
  scalarCount,
}: {
  bitsAllocated: number;
  bitsStored: number;
  byteArray: Uint8Array;
  highBit: number;
  isLittleEndian: boolean;
  pixelElement: DicomElement;
  pixelRepresentation: number;
  scalarCount: number;
}): Uint8Array | Uint16Array | Int16Array {
  const bytesPerScalar = Math.ceil(bitsAllocated / 8);
  const requiredLength = scalarCount * bytesPerScalar;

  if (bitsAllocated !== 8 && bitsAllocated !== 16) {
    throw new Error(`BitsAllocated non pris en charge (${bitsAllocated})`);
  }

  if (pixelElement.length < requiredLength) {
    throw new Error("PixelData DICOM incomplet");
  }

  const dataView = new DataView(
    byteArray.buffer,
    byteArray.byteOffset + pixelElement.dataOffset,
    requiredLength,
  );

  if (pixelRepresentation === 1) {
    const signedPixels = new Int16Array(scalarCount);

    for (let index = 0; index < scalarCount; index += 1) {
      const storedValue =
        bitsAllocated === 8
          ? dataView.getUint8(index)
          : dataView.getUint16(index * 2, isLittleEndian);
      signedPixels[index] = normalizeStoredPixelValue(
        storedValue,
        bitsStored,
        highBit,
        pixelRepresentation,
      );
    }

    return signedPixels;
  }

  const unsignedPixels =
    bitsAllocated === 8
      ? new Uint8Array(scalarCount)
      : new Uint16Array(scalarCount);

  for (let index = 0; index < scalarCount; index += 1) {
    const storedValue =
      bitsAllocated === 8
        ? dataView.getUint8(index)
        : dataView.getUint16(index * 2, isLittleEndian);
    unsignedPixels[index] = normalizeStoredPixelValue(
      storedValue,
      bitsStored,
      highBit,
      pixelRepresentation,
    );
  }

  return unsignedPixels;
}

function normalizeStoredPixelValue(
  value: number,
  bitsStored: number,
  highBit: number,
  pixelRepresentation: number,
) {
  const shift = Math.max(0, highBit + 1 - bitsStored);
  const unsignedValue = shift > 0 ? value >> shift : value;
  const mask = bitsStored >= 32 ? 0xffffffff : (1 << bitsStored) - 1;
  const storedValue = unsignedValue & mask;

  if (pixelRepresentation !== 1) {
    return storedValue;
  }

  const signBit = 1 << (bitsStored - 1);
  return storedValue & signBit ? storedValue - (1 << bitsStored) : storedValue;
}

function applyRescale(
  pixelData: Uint8Array | Uint16Array | Int16Array,
  slope: number,
  intercept: number,
): ScalarPixelData {
  if (slope === 1 && intercept === 0) {
    return pixelData;
  }

  const rescaledPixelData = new Float32Array(pixelData.length);

  for (let index = 0; index < pixelData.length; index += 1) {
    rescaledPixelData[index] = pixelData[index] * slope + intercept;
  }

  return rescaledPixelData;
}

function getMinMax(pixelData: ScalarPixelData) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < pixelData.length; index += 1) {
    const value = pixelData[index];

    if (value < min) {
      min = value;
    }

    if (value > max) {
      max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }

  return { min, max };
}

function getScalarPixelDataType(pixelData: ScalarPixelData): ScalarPixelDataType {
  if (pixelData instanceof Uint8Array) {
    return "Uint8Array";
  }

  if (pixelData instanceof Uint16Array) {
    return "Uint16Array";
  }

  if (pixelData instanceof Int16Array) {
    return "Int16Array";
  }

  return "Float32Array";
}

function requireDicomUint16(
  dataSet: DicomDataSet,
  tag: string,
  label: string,
) {
  const value = dataSet.uint16(tag);

  if (!value) {
    throw new Error(`Tag DICOM obligatoire absent: ${label}`);
  }

  return value;
}

function readDicomFloatVector(
  dataSet: DicomDataSet,
  tag: string,
  expectedCount: number,
): number[] | undefined {
  const values = Array.from({ length: expectedCount }, (_, index) =>
    dataSet.floatString(tag, index),
  );

  if (!values.every((value) => typeof value === "number")) {
    return undefined;
  }

  return values as number[];
}

function readDicomFloatTuple3(
  dataSet: DicomDataSet,
  tag: string,
): [number, number, number] | undefined {
  const values = readDicomFloatVector(dataSet, tag, 3);

  if (!values) {
    return undefined;
  }

  return [values[0], values[1], values[2]];
}

function applyInitialWindowLevel(viewport: Types.IStackViewport) {
  const image = viewport.getCornerstoneImage();
  const windowCenter = Array.isArray(image.windowCenter)
    ? image.windowCenter[0]
    : image.windowCenter;
  const windowWidth = Array.isArray(image.windowWidth)
    ? image.windowWidth[0]
    : image.windowWidth;
  const hasDicomWindow =
    Number.isFinite(windowCenter) &&
    Number.isFinite(windowWidth) &&
    windowWidth > 0;
  const lower = hasDicomWindow
    ? windowCenter - windowWidth / 2
    : Number.isFinite(image.minPixelValue)
      ? image.minPixelValue
      : 0;
  const upper = hasDicomWindow
    ? windowCenter + windowWidth / 2
    : Number.isFinite(image.maxPixelValue)
      ? image.maxPixelValue
      : 4095;

  viewport.setProperties({
    voiRange:
      upper > lower
        ? { lower, upper }
        : {
            lower: 0,
            upper: 4095,
          },
    invert: false,
  });
}

function attachStackIndexListener(
  core: CornerstoneCoreModule,
  viewport: Types.IStackViewport,
  element: HTMLDivElement,
  setCurrentSliceIndex: (sliceIndex: number) => void,
) {
  const updateSliceIndex = () => {
    setCurrentSliceIndex(viewport.getCurrentImageIdIndex() + 1);
  };

  element.addEventListener(core.Enums.Events.STACK_NEW_IMAGE, updateSliceIndex);
  element.addEventListener(core.Enums.Events.IMAGE_RENDERED, updateSliceIndex);

  return () => {
    element.removeEventListener(
      core.Enums.Events.STACK_NEW_IMAGE,
      updateSliceIndex,
    );
    element.removeEventListener(
      core.Enums.Events.IMAGE_RENDERED,
      updateSliceIndex,
    );
  };
}

function attachPrimarySliceDragListener(
  viewport: Types.IStackViewport,
  element: HTMLDivElement,
  options: {
    axis: SliceNavigation["axis"];
    getActivePrimaryTool: () => ActivePrimaryTool;
    setCurrentSliceIndex: (sliceIndex: number) => void;
    setViewerError: (error: unknown) => void;
    sliceCount: number;
  },
) {
  let dragState:
    | {
        appliedSliceIndex: number;
        pointerId: number;
        startCoordinate: number;
        startSliceIndex: number;
      }
    | null = null;

  const stopSliceDragEvent = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const applySliceIndex = (nextSliceIndex: number) => {
    const clampedSliceIndex = Math.min(
      Math.max(Math.round(nextSliceIndex), 1),
      options.sliceCount,
    );

    options.setCurrentSliceIndex(clampedSliceIndex);
    void viewport
      .setImageIdIndex(clampedSliceIndex - 1)
      .then(() => {
        viewport.render();
      })
      .catch(options.setViewerError);

    return clampedSliceIndex;
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      options.sliceCount <= 1 ||
      options.getActivePrimaryTool() !== "slice"
    ) {
      return;
    }

    stopSliceDragEvent(event);
    dragState = {
      appliedSliceIndex: viewport.getCurrentImageIdIndex() + 1,
      pointerId: event.pointerId,
      startCoordinate:
        options.axis === "horizontal" ? event.clientX : event.clientY,
      startSliceIndex: viewport.getCurrentImageIdIndex() + 1,
    };

    element.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    stopSliceDragEvent(event);

    if (options.getActivePrimaryTool() !== "slice") {
      dragState = null;
      return;
    }

    const currentCoordinate =
      options.axis === "horizontal" ? event.clientX : event.clientY;
    const sliceDelta = Math.trunc(
      (currentCoordinate - dragState.startCoordinate) /
        SLICE_DRAG_PIXELS_PER_STEP,
    );
    const nextSliceIndex = Math.min(
      Math.max(dragState.startSliceIndex + sliceDelta, 1),
      options.sliceCount,
    );

    if (nextSliceIndex === dragState.appliedSliceIndex) {
      return;
    }

    dragState.appliedSliceIndex = applySliceIndex(nextSliceIndex);
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    stopSliceDragEvent(event);

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    dragState = null;
  };

  const handleLostPointerCapture = (event: PointerEvent) => {
    if (dragState?.pointerId === event.pointerId) {
      dragState = null;
    }
  };

  element.addEventListener("pointerdown", handlePointerDown, {
    capture: true,
  });
  element.addEventListener("pointermove", handlePointerMove, {
    capture: true,
  });
  element.addEventListener("pointerup", endDrag, { capture: true });
  element.addEventListener("pointercancel", endDrag, { capture: true });
  element.addEventListener("lostpointercapture", handleLostPointerCapture);

  return () => {
    element.removeEventListener("pointerdown", handlePointerDown, {
      capture: true,
    });
    element.removeEventListener("pointermove", handlePointerMove, {
      capture: true,
    });
    element.removeEventListener("pointerup", endDrag, { capture: true });
    element.removeEventListener("pointercancel", endDrag, { capture: true });
    element.removeEventListener("lostpointercapture", handleLostPointerCapture);
  };
}

function attachCtrlWheelZoomListener(
  viewport: Types.IStackViewport,
  element: HTMLDivElement,
  setViewControls: (controls: ViewControlState) => void,
) {
  const handleWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentZoom = viewport.getZoom();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nextZoom = Math.min(
      DEFAULT_CONTROL_RANGES.zoom.max,
      Math.max(DEFAULT_CONTROL_RANGES.zoom.min, currentZoom * zoomFactor),
    );

    viewport.setZoom(nextZoom);
    viewport.render();
    setViewControls(readViewControls(viewport));
  };

  element.addEventListener("wheel", handleWheel, {
    capture: true,
    passive: false,
  });

  return () => {
    element.removeEventListener("wheel", handleWheel, { capture: true });
  };
}

function attachViewControlListeners(
  core: CornerstoneCoreModule,
  viewport: Types.IStackViewport,
  setViewControls: (controls: ViewControlState) => void,
) {
  const syncControls = () => {
    setViewControls(readViewControls(viewport));
  };

  viewport.element.addEventListener(core.Enums.Events.CAMERA_MODIFIED, syncControls);
  viewport.element.addEventListener(core.Enums.Events.CAMERA_RESET, syncControls);
  viewport.element.addEventListener(core.Enums.Events.VOI_MODIFIED, syncControls);
  viewport.element.addEventListener(core.Enums.Events.IMAGE_RENDERED, syncControls);

  return () => {
    viewport.element.removeEventListener(
      core.Enums.Events.CAMERA_MODIFIED,
      syncControls,
    );
    viewport.element.removeEventListener(
      core.Enums.Events.CAMERA_RESET,
      syncControls,
    );
    viewport.element.removeEventListener(
      core.Enums.Events.VOI_MODIFIED,
      syncControls,
    );
    viewport.element.removeEventListener(
      core.Enums.Events.IMAGE_RENDERED,
      syncControls,
    );
  };
}

function attachArrowAnnotationListeners(
  core: CornerstoneCoreModule,
  tools: CornerstoneToolsModule,
  viewport: Types.IStackViewport,
  callbacks: {
    getDefaultColor: () => string;
    setSelectedArrowColor: (color: string) => void;
    setSelectedArrowLabel: (label: string) => void;
    setSelectedArrowUid: (uid: string) => void;
  },
) {
  const syncSelectedAnnotation = (annotationUid: string | undefined) => {
    const annotation = annotationUid
      ? (tools.annotation.state.getAnnotation(annotationUid) as
          | ArrowAnnotation
          | undefined)
      : undefined;

    if (!isArrowAnnotation(tools, annotation)) {
      callbacks.setSelectedArrowUid("");
      callbacks.setSelectedArrowLabel("");
      return;
    }

    callbacks.setSelectedArrowUid(annotation.annotationUID ?? "");
    callbacks.setSelectedArrowLabel(annotation.data?.label ?? "");
    callbacks.setSelectedArrowColor(
      getArrowAnnotationColor(tools, annotation) ?? callbacks.getDefaultColor(),
    );
  };

  const handleAnnotationCompleted = (event: Event) => {
    const annotation = (
      event as CustomEvent<{
        annotation?: ArrowAnnotation;
      }>
    ).detail?.annotation;

    if (!isArrowAnnotation(tools, annotation)) {
      return;
    }

    annotation.data.label ||= "Fleche";

    if (annotation.annotationUID) {
      applyArrowAnnotationColor(tools, annotation, callbacks.getDefaultColor());
      tools.annotation.selection.setAnnotationSelected(
        annotation.annotationUID,
        true,
      );
      callbacks.setSelectedArrowUid(annotation.annotationUID);
    }
    callbacks.setSelectedArrowLabel(annotation.data.label);
    callbacks.setSelectedArrowColor(callbacks.getDefaultColor());
    tools.annotation.state.triggerAnnotationModified(annotation, viewport.element);
    tools.utilities.triggerAnnotationRenderForViewportIds([viewport.id]);
  };

  const handleSelectionChanged = (event: Event) => {
    const selection = (
      event as CustomEvent<{
        selection?: string[];
      }>
    ).detail?.selection;

    const arrowUid = selection
      ?.toReversed()
      .find((annotationUid) =>
        isArrowAnnotation(
          tools,
          tools.annotation.state.getAnnotation(annotationUid) as
            | ArrowAnnotation
            | undefined,
        ),
      );

    syncSelectedAnnotation(arrowUid);
  };

  const handleAnnotationModified = (event: Event) => {
    const annotation = (
      event as CustomEvent<{
        annotation?: ArrowAnnotation;
      }>
    ).detail?.annotation;

    if (isArrowAnnotation(tools, annotation) && annotation.annotationUID) {
      syncSelectedAnnotation(annotation.annotationUID);
    }
  };

  core.eventTarget.addEventListener(
    tools.Enums.Events.ANNOTATION_COMPLETED,
    handleAnnotationCompleted,
  );
  core.eventTarget.addEventListener(
    tools.Enums.Events.ANNOTATION_SELECTION_CHANGE,
    handleSelectionChanged,
  );
  core.eventTarget.addEventListener(
    tools.Enums.Events.ANNOTATION_MODIFIED,
    handleAnnotationModified,
  );

  return () => {
    core.eventTarget.removeEventListener(
      tools.Enums.Events.ANNOTATION_COMPLETED,
      handleAnnotationCompleted,
    );
    core.eventTarget.removeEventListener(
      tools.Enums.Events.ANNOTATION_SELECTION_CHANGE,
      handleSelectionChanged,
    );
    core.eventTarget.removeEventListener(
      tools.Enums.Events.ANNOTATION_MODIFIED,
      handleAnnotationModified,
    );
  };
}

function windowPresetToVoiRange(preset: WindowPreset) {
  return windowLevelToVoiRange(preset.center, preset.width);
}

function windowLevelToVoiRange(windowCenter: number, windowWidth: number) {
  return {
    lower: windowCenter - windowWidth / 2,
    upper: windowCenter + windowWidth / 2,
  };
}

function readViewControls(viewport: Types.IStackViewport): ViewControlState {
  const properties = viewport.getProperties();
  const voiRange = properties.voiRange ?? { lower: 0, upper: 1 };
  const pan = viewport.getPan();

  return {
    panX: roundControlValue(pan[0]),
    panY: roundControlValue(pan[1]),
    windowCenter: roundControlValue((voiRange.lower + voiRange.upper) / 2),
    windowWidth: roundControlValue(Math.max(1, voiRange.upper - voiRange.lower)),
    zoom: roundControlValue(viewport.getZoom(), 100),
  };
}

function getControlRanges(viewport: Types.IStackViewport): ControlRanges {
  const image = viewport.getCornerstoneImage();
  const minPixelValue = Number.isFinite(image.minPixelValue)
    ? image.minPixelValue
    : DEFAULT_CONTROL_RANGES.windowCenter.min;
  const maxPixelValue = Number.isFinite(image.maxPixelValue)
    ? image.maxPixelValue
    : DEFAULT_CONTROL_RANGES.windowCenter.max;
  const pixelRange = Math.max(1, maxPixelValue - minPixelValue);
  const rect = viewport.element.getBoundingClientRect();
  const panMax = Math.max(
    DEFAULT_CONTROL_RANGES.pan.max,
    Math.ceil(Math.max(rect.width, rect.height) * 2),
  );

  return {
    pan: { min: -panMax, max: panMax },
    windowCenter: {
      min: Math.floor(Math.min(minPixelValue, DEFAULT_CONTROL_RANGES.windowCenter.min)),
      max: Math.ceil(Math.max(maxPixelValue, DEFAULT_CONTROL_RANGES.windowCenter.max)),
    },
    windowWidth: {
      min: 1,
      max: Math.ceil(
        Math.max(
          pixelRange,
          DEFAULT_CONTROL_RANGES.windowWidth.max,
          ...WINDOW_PRESETS.map((preset) => preset.width),
        ),
      ),
    },
    zoom: DEFAULT_CONTROL_RANGES.zoom,
  };
}

function roundControlValue(value: number, multiplier = 1) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * multiplier) / multiplier;
}

function isArrowAnnotation(
  tools: CornerstoneToolsModule,
  annotation: ArrowAnnotation | undefined,
): annotation is ArrowAnnotation {
  return annotation?.metadata?.toolName === tools.ArrowAnnotateTool.toolName;
}

function applyArrowAnnotationColor(
  tools: CornerstoneToolsModule,
  annotation: ArrowAnnotation,
  color: string,
) {
  const annotationUid = annotation.annotationUID;

  if (!annotationUid) {
    return;
  }

  const rgbColor = hexToRgbCss(color);

  tools.annotation.config.style.setAnnotationStyles(annotationUid, {
    color: rgbColor,
    colorHighlighted: rgbColor,
    colorSelected: rgbColor,
    lineWidth: "2",
    markerSize: "12",
    textBoxColor: rgbColor,
    textBoxColorHighlighted: rgbColor,
    textBoxColorSelected: rgbColor,
  });
}

function getArrowAnnotationColor(
  tools: CornerstoneToolsModule,
  annotation: ArrowAnnotation,
) {
  const annotationUid = annotation.annotationUID;

  if (!annotationUid) {
    return null;
  }

  const styles =
    tools.annotation.config.style.getAnnotationToolStyles(annotationUid);
  const color = styles?.color;

  return typeof color === "string" ? rgbCssToHex(color) : null;
}

function hexToRgbCss(hexColor: string) {
  const normalizedHex = hexColor.replace("#", "");
  const value = Number.parseInt(normalizedHex, 16);

  if (!Number.isFinite(value)) {
    return "rgb(250, 204, 21)";
  }

  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

function rgbCssToHex(color: string) {
  const match = color.match(/\d+/g);

  if (!match || match.length < 3) {
    return DEFAULT_ARROW_COLOR;
  }

  const [red, green, blue] = match.slice(0, 3).map((value) => {
    const channel = Math.max(0, Math.min(255, Number(value)));
    return channel.toString(16).padStart(2, "0");
  });

  return `#${red}${green}${blue}`;
}

async function renderViewportPng(viewport: Types.IStackViewport) {
  const sourceCanvas = viewport.getCanvas();
  const outputCanvas = window.document.createElement("canvas");
  const context = outputCanvas.getContext("2d");

  if (!context) {
    throw new Error("Export PNG impossible");
  }

  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  context.drawImage(sourceCanvas, 0, 0);
  await drawViewportSvgOverlays(viewport.element, outputCanvas, context);

  return new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Export PNG impossible"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

async function drawViewportSvgOverlays(
  viewportElement: HTMLDivElement,
  outputCanvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) {
  const viewportRect = viewportElement.getBoundingClientRect();
  const dpr = outputCanvas.width / Math.max(1, viewportRect.width);
  const svgElements = Array.from(viewportElement.querySelectorAll("svg"));

  for (const svgElement of svgElements) {
    const svgText = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = await loadImage(url);
      const rect = svgElement.getBoundingClientRect();

      context.drawImage(
        image,
        (rect.left - viewportRect.left) * dpr,
        (rect.top - viewportRect.top) * dpr,
        rect.width * dpr,
        rect.height * dpr,
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Export des annotations impossible"));
    image.src = url;
  });
}

function sanitizeFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "scanner"
  );
}
