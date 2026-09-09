import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Focus,
  HelpCircle,
  Image,
  Menu,
  Moon,
  RotateCcw,
  Sun,
  X,
} from "lucide-react";
import {
  ModelViewer,
  type ViewerHandle,
} from "./components/viewer/ModelViewer";
import { loadModel, disposeModel } from "./loaders/loadModel";
import { calculate3DPrintPricing } from "./pricing/calculate3DPrintPricing";
import { quickEstimate } from "./pricing/estimateMaterial";
import { checkPrinterFit } from "./geometry/printerFit";
import { calculateScaleToFit } from "./geometry/scaleToFit";
import { ViewerErrorBoundary } from "./components/common/ViewerErrorBoundary";
import { Dialog } from "./components/common/Dialog";
import { OverflowMenu } from "./components/common/OverflowMenu";
import { EmptyUploadState } from "./components/upload/EmptyUploadState";
import { ViewerToolbar, type CameraPreset } from "./components/viewer/ViewerToolbar";
import { ConfirmDialog, ProfileDialog, type EditorState } from "./components/profiles/ProfileDialogs";
import { modelMatrix } from "./geometry/analyzeGeometry";
import { analyzeOffMain } from "./geometry/analyzeOffMain";
import {
  loadSettings,
  saveSettings,
  importSettings,
  resetSettings,
  type Settings,
} from "./storage/settingsStorage";
import { downloadQuotation } from "./utils/pdfQuotation";
import type { GeometryAnalysis, LoadedModel, TransformState } from "./types";
const initialTransform: TransformState = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};
const money = (n: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(n);
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = "any",
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number | "any";
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null),
    errorId = useId();
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value));
  }, [value]);
  const parsed = Number(draft),
    valid =
      draft.trim() !== "" &&
      Number.isFinite(parsed) &&
      parsed >= min &&
      (max === undefined || parsed <= max);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        ref={inputRef}
        type="number"
        min={min}
        step={step}
        value={draft}
        aria-invalid={!valid}
        aria-describedby={!valid ? errorId : undefined}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const next = Number(raw);
          if (
            raw.trim() !== "" &&
            Number.isFinite(next) &&
            next >= min &&
            (max === undefined || next <= max)
          )
            onChange(next);
        }}
        onBlur={() => {
          if (!valid) setDraft(String(value));
        }}
      />
      {!valid && (
        <small id={errorId} role="alert">
          Enter a finite value from {min}
          {max === undefined ? " or greater" : ` to ${max}`}.
        </small>
      )}
    </label>
  );
}
function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [transform, setTransform] = useState(initialTransform);
  const [printerId, setPrinterId] = useState(settings.printers[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(settings.materials[0]?.id ?? "");
  const [mode, setMode] = useState<"solid" | "wireframe" | "edges">("edges");
  const [showModel, setShowModel] = useState(true),
    [showGrid, setShowGrid] = useState(true),
    [showAxes, setShowAxes] = useState(true),
    [showVolume, setShowVolume] = useState(true),
    [ortho, setOrtho] = useState(false);
  const [estimating, setEstimating] = useState<"manual" | "quick">("manual");
  const [filament, setFilament] = useState(50),
    [hours, setHours] = useState(2),
    [minutes, setMinutes] = useState(0),
    [infill, setInfill] = useState(20),
    [shell, setShell] = useState(1.35),
    [support, setSupport] = useState(10),
    [waste, setWaste] = useState(5),
    [flow, setFlow] = useState(12);
  const [laborMinutes, setLaborMinutes] = useState(15),
    [parts, setParts] = useState(0),
    [quantity, setQuantity] = useState(1),
    [taxEnabled, setTaxEnabled] = useState(false);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [drag, setDrag] = useState(false),
    [rightOpen, setRightOpen] = useState(false),
    [leftOpen, setLeftOpen] = useState(false),
    [help, setHelp] = useState(
      () => !localStorage.getItem("printscope.help.seen"),
    );
  const [customer, setCustomer] = useState(""),
    [contact, setContact] = useState(""),
    [project, setProject] = useState(""),
    [notes, setNotes] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const viewer = useRef<ViewerHandle>(null),
    fileInput = useRef<HTMLInputElement>(null),
    viewportRef = useRef<HTMLElement>(null),
    loadGeneration = useRef(0),
    loadAbort = useRef<AbortController | null>(null),
    helpButtonRef = useRef<HTMLButtonElement>(null),
    previousHelp = useRef(help),
    leftDrawerRef = useRef<HTMLElement>(null),
    rightDrawerRef = useRef<HTMLElement>(null),
    leftOpenerRef = useRef<HTMLButtonElement>(null),
    rightOpenerRef = useRef<HTMLButtonElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>("isometric");
  const [activeTab, setActiveTab] = useState<"model" | "estimate" | "pricing" | "quotation">("model");
  const [compactLayout, setCompactLayout] = useState(false);
  const [profileEditor, setProfileEditor] = useState<EditorState | null>(null);
  const [deleteProfile, setDeleteProfile] = useState<"printer" | "material" | null>(null);
  const [advancedScale, setAdvancedScale] = useState(false);
  const [unreliableAcknowledged, setUnreliableAcknowledged] = useState(false);
  const [useModelColors, setUseModelColors] = useState(true);
  const [transformedAnalysis, setTransformedAnalysis] =
    useState<GeometryAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const transformAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    const media = matchMedia("(max-width: 1179px)");
    const update = () => setCompactLayout(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!compactLayout) return;
    const open = leftOpen ? leftDrawerRef.current : rightOpen ? rightDrawerRef.current : null;
    if (open) {
      open.querySelector<HTMLElement>("[data-drawer-heading]")?.focus();
      document.body.classList.add("drawer-open");
    } else {
      document.body.classList.remove("drawer-open");
    }
    return () => document.body.classList.remove("drawer-open");
  }, [compactLayout, leftOpen, rightOpen]);
  useEffect(() => {
    if (previousHelp.current && !help) helpButtonRef.current?.focus();
    previousHelp.current = help;
  }, [help]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelp(false);
        if (leftOpen) leftOpenerRef.current?.focus();
        if (rightOpen) rightOpenerRef.current?.focus();
        setLeftOpen(false);
        setRightOpen(false);
      }
      if (event.key === "Tab" && compactLayout && (leftOpen || rightOpen)) {
        const drawer = leftOpen ? leftDrawerRef.current : rightDrawerRef.current;
        const items = drawer?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])');
        if (!items?.length) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [compactLayout, leftOpen, rightOpen]);
  const printer =
    settings.printers.find((p) => p.id === printerId) ?? settings.printers[0]!;
  const material =
    settings.materials.find((m) => m.id === materialId) ??
    settings.materials[0]!;
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      settings.theme === "dark",
    );
    if (!saveSettings(settings))
      setError(
        "Settings could not be saved because browser storage is unavailable or full.",
      );
  }, [settings]);
  useEffect(() => () => disposeModel(model), [model]);
  useEffect(() => {
    transformAbort.current?.abort();
    if (!model) {
      setTransformedAnalysis(null);
      return;
    }
    const controller = new AbortController();
    transformAbort.current = controller;
    setTransformedAnalysis(null);
    setAnalyzing(true);
    const matrices = model.geometries.map(() =>
      modelMatrix(model.normalization, transform),
    );
    void analyzeOffMain(model.geometries, matrices, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setTransformedAnalysis(result);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setError("Transformed geometry analysis failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalyzing(false);
      });
    return () => controller.abort();
  }, [model, transform]);
  const dimensions = transformedAnalysis?.dimensions ?? {
    width: 0,
    depth: 0,
    height: 0,
  };
  const fit = checkPrinterFit(transformedAnalysis?.bounds ?? null, printer);
  const auto = useMemo(
    () =>
      quickEstimate({
        volumeCm3: transformedAnalysis?.volumeCm3 ?? 0,
        density: material.density,
        infillPercent: infill,
        shellFactor: shell,
        supportPercent: support,
        wastePercent: waste,
        flowRateGPerHour: flow,
      }),
    [
      transformedAnalysis,
      material.density,
      infill,
      shell,
      support,
      waste,
      flow,
    ],
  );
  const used = estimating === "manual" ? filament : auto.filamentGrams;
  const printHours =
    estimating === "manual" ? hours + minutes / 60 : auto.printHours;
  const pricing = useMemo(
    () =>
      calculate3DPrintPricing({
        filamentCostPerKg: material.costPerKg,
        filamentUsedGrams: used,
        printTimeHours: printHours,
        laborMinutes,
        laborRatePerHour: settings.laborRate,
        printerPowerW: printer.powerW,
        electricityCostPerKwh: settings.electricity,
        annualMaintenanceCost: settings.maintenance,
        estimatedAnnualPrintHours: settings.annualHours,
        partsCost: parts,
        bufferPercent: settings.buffer,
        profitPercent: settings.markup,
        taxEnabled,
        taxRate: settings.tax,
        quantity,
        currency: settings.currency,
      }),
    [
      material.costPerKg,
      used,
      printHours,
      laborMinutes,
      settings,
      printer.powerW,
      parts,
      taxEnabled,
      quantity,
    ],
  );
  async function selectFile(file?: File) {
    if (!file) return;
    const generation = ++loadGeneration.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    setError("");
    try {
      const next = await loadModel(file, controller.signal);
      if (generation !== loadGeneration.current) {
        disposeModel(next);
        return;
      }
      setModel(next);
      setUnreliableAcknowledged(false);
      setTransform(initialTransform);
      setProject(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(
          e instanceof Error ? e.message : "The model could not be loaded.",
        );
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  async function downloadImage() {
    try {
      const url = viewer.current?.screenshot();
      if (!url) throw new Error();
      const blob = await fetch(url).then((response) => response.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${model?.name.replace(/\.[^.]+$/, "") ?? "PrintScope-model"}-screenshot.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      setError("Screenshot could not be created.");
    }
  }
  function toggleFullscreen() {
    const action = isFullscreen
      ? document.exitFullscreen()
      : viewportRef.current?.requestFullscreen?.();
    if (!action) {
      setError("Fullscreen is unavailable in this browser.");
      return;
    }
    void action.catch(() =>
      setError("Fullscreen is unavailable in this browser."),
    );
  }
  function scaleToFit() {
    if (!model) return;
    const ratio = calculateScaleToFit(model.analysis.dimensions, printer.build);
    setTransform({
      ...initialTransform,
      scale: [ratio, ratio, ratio],
    });
  }
  function editPrinterProfile(duplicate = false) {
    setProfileEditor({ kind: "printer", duplicate, value: { ...printer, build: { ...printer.build }, id: duplicate ? `printer-${crypto.randomUUID()}` : printer.id, name: duplicate ? `${printer.name} copy` : printer.name, custom: duplicate || printer.custom } });
  }
  function deletePrinterProfile() {
    if (!printer.custom) {
      setError(
        "Built-in printers can be edited but not deleted. Restore defaults to undo edits.",
      );
      return;
    }
    if (settings.printers.length === 1) return;
    const remaining = settings.printers.filter((p) => p.id !== printer.id);
    setSettings((s) => ({ ...s, printers: remaining }));
    setPrinterId(remaining[0]!.id);
  }
  function editMaterialProfile(duplicate = false) {
    setProfileEditor({ kind: "material", duplicate, value: { ...material, id: duplicate ? `material-${crypto.randomUUID()}` : material.id, name: duplicate ? `${material.name} copy` : material.name, custom: duplicate || material.custom } });
  }
  function saveProfile(next: EditorState) {
    if (next.kind === "printer") {
      setSettings((current) => ({ ...current, printers: next.duplicate ? [...current.printers, next.value] : current.printers.map((item) => item.id === next.value.id ? next.value : item) }));
      if (next.duplicate) setPrinterId(next.value.id);
    } else {
      setSettings((current) => ({ ...current, materials: next.duplicate ? [...current.materials, next.value] : current.materials.map((item) => item.id === next.value.id ? next.value : item) }));
      if (next.duplicate) setMaterialId(next.value.id);
    }
    setProfileEditor(null);
  }
  function deleteMaterialProfile() {
    if (!material.custom) {
      setError(
        "Built-in materials can be edited but not deleted. Restore defaults to undo edits.",
      );
      return;
    }
    if (settings.materials.length === 1) return;
    const remaining = settings.materials.filter((m) => m.id !== material.id);
    setSettings((s) => ({ ...s, materials: remaining }));
    setMaterialId(remaining[0]!.id);
  }
  const displayOptions: Array<[string, boolean, (value: boolean) => void]> = [
    ["Model visible", showModel, setShowModel],
    ["Build plate grid", showGrid, setShowGrid],
    ["Axes", showAxes, setShowAxes],
    ["Build volume", showVolume, setShowVolume],
    ["Orthographic camera", ortho, setOrtho],
  ];
  return (
    <div className="app">
      <header>
        <button
          ref={leftOpenerRef}
          className="mobile"
          aria-label={leftOpen ? "Close model settings" : "Open model settings"}
          aria-expanded={leftOpen}
          onClick={() => {
            setRightOpen(false);
            setLeftOpen((open) => !open);
          }}
        >
          {leftOpen ? <X /> : <Menu />}
        </button>
        <a className="logo" href={import.meta.env.BASE_URL} aria-label="Reload PrintScope">
          <Box /> <span>PrintScope</span>
          <small>3D Viewer & Cost Estimator</small>
        </a>
        <div className="toolbar header-toolbar">
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".stl,.3mf"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              void selectFile(e.target.files?.[0]).finally(() => {
                e.target.value = "";
              })
            }
          />
          <button
            className="primary"
            onClick={() => fileInput.current?.click()}
          >
            <FileUp /> {model ? "Replace" : "Upload"} Model
          </button>
          <div className="header-secondary">
          <button
            aria-label="Reset camera view"
            title="Reset view"
            onClick={() => viewer.current?.reset()}
          >
            <Focus />
          </button>
          <button
            aria-label="Download model screenshot"
            title="Screenshot"
            disabled={!model}
            onClick={() => void downloadImage()}
          >
            <Image />
          </button>
          <button
            aria-label={`Switch to ${settings.theme === "dark" ? "light" : "dark"} theme`}
            title="Toggle theme"
            onClick={() =>
              updateSetting(
                "theme",
                settings.theme === "dark" ? "light" : "dark",
              )
            }
          >
            {settings.theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <button
            ref={helpButtonRef}
            aria-label="Open help"
            title="Help"
            onClick={() => setHelp(true)}
          >
            <HelpCircle />
          </button>
          </div>
          <OverflowMenu>
            <button role="menuitem" disabled={!model} onClick={() => viewer.current?.reset()}><Focus /> Reset camera</button>
            <button role="menuitem" disabled={!model} onClick={() => void downloadImage()}><Image /> Screenshot</button>
            <button role="menuitem" onClick={toggleFullscreen}><Focus /> {isFullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
            <button role="menuitem" onClick={() => updateSetting("theme", settings.theme === "dark" ? "light" : "dark")}>{settings.theme === "dark" ? <Sun /> : <Moon />} Theme</button>
            <button role="menuitem" onClick={() => setHelp(true)}><HelpCircle /> Help</button>
          </OverflowMenu>
        </div>
        <button
          ref={rightOpenerRef}
          className="mobile"
          aria-label={rightOpen ? "Close estimate and quotation" : "Open estimate and quotation"}
          aria-expanded={rightOpen}
          onClick={() => {
            setLeftOpen(false);
            setRightOpen((open) => !open);
          }}
        >
          {rightOpen ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </header>
      <main>
        {(leftOpen || rightOpen) && (
          <button
            className="drawer-backdrop mobile"
            aria-label="Close navigation drawer"
            onClick={() => {
              if (leftOpen) leftOpenerRef.current?.focus();
              if (rightOpen) rightOpenerRef.current?.focus();
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
        <aside ref={leftDrawerRef} className={`left ${leftOpen ? "open" : ""}`} role={compactLayout ? "dialog" : undefined} aria-modal={compactLayout && leftOpen ? "true" : undefined} aria-label="Model settings" aria-hidden={compactLayout && !leftOpen ? "true" : undefined} inert={compactLayout && !leftOpen}>
          <div className="drawer-topbar mobile">
            <strong data-drawer-heading tabIndex={-1}>Model settings</strong>
          </div>
          <h2>Model</h2>
          {model ? (
            <div className="file-card">
              <b>{model.name}</b>
              <span>
                {(model.size / 1048576).toFixed(2)} MB ·{" "}
                {model.extension.toUpperCase()}
              </span>
              <button
                onClick={() => {
                  loadGeneration.current++;
                  loadAbort.current?.abort();
                  setModel(null);
                  setTransform(initialTransform);
                }}
              >
                Remove model
              </button>
            </div>
          ) : (
            <p className="muted">Upload a model to inspect and transform it.</p>
          )}
          <h2>Printer</h2>
          <label className="field">
            <span>Profile</span>
            <select
              value={printer.id}
              onChange={(e) => setPrinterId(e.target.value)}
            >
              {settings.printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="row profile-actions">
            <button onClick={() => editPrinterProfile(false)}>Edit</button>
            <button onClick={() => editPrinterProfile(true)}>
              Duplicate / add
            </button>
            <button
              disabled={!printer.custom || settings.printers.length === 1}
              onClick={() => setDeleteProfile("printer")}
            >
              Delete custom
            </button>
          </div>
          <p className="muted">
            {printer.build.width} × {printer.build.depth} ×{" "}
            {printer.build.height} mm · {printer.powerW} W
          </p>
          <h2>Material</h2>
          <label className="field">
            <span>Profile</span>
            <select
              value={material.id}
              onChange={(e) => setMaterialId(e.target.value)}
            >
              {settings.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="row profile-actions">
            <button onClick={() => editMaterialProfile(false)}>Edit</button>
            <button onClick={() => editMaterialProfile(true)}>
              Duplicate / add
            </button>
            <button
              disabled={!material.custom || settings.materials.length === 1}
              onClick={() => setDeleteProfile("material")}
            >
              Delete custom
            </button>
          </div>
          <NumberField
            label="Density (g/cm³)"
            value={material.density}
            min={0.001}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                materials: s.materials.map((m) =>
                  m.id === material.id ? { ...m, density: v } : m,
                ),
              }))
            }
          />
          <NumberField
            label={`Cost / kg (${settings.currency})`}
            value={material.costPerKg}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                materials: s.materials.map((m) =>
                  m.id === material.id ? { ...m, costPerKg: v } : m,
                ),
              }))
            }
          />
          <label className="field">
            <span>Model colour</span>
            <input
              type="color"
              value={material.color}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  materials: s.materials.map((m) =>
                    m.id === material.id ? { ...m, color: e.target.value } : m,
                  ),
                }))
              }
            />
          </label>
          {model?.hasModelColors && (
            <label className="toggle">
              <span>Use model colours</span>
              <input disabled={!model}
                type="checkbox"
                checked={useModelColors}
                onChange={(e) => setUseModelColors(e.target.checked)}
              />
            </label>
          )}
          <h2>Display</h2>
          <label className="field">
            <span>Render mode</span>
            <select
              disabled={!model}
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="solid">Solid</option>
              <option value="wireframe">Wireframe</option>
              <option value="edges">Solid with edges</option>
            </select>
          </label>
          {displayOptions.map(([l, v, set]) => (
            <label className="toggle" key={String(l)}>
              <span>{l}</span>
              <input
                disabled={!model}
                type="checkbox"
                checked={Boolean(v)}
                onChange={(e) => set(e.target.checked)}
              />
            </label>
          ))}
        </aside>
        <section
          ref={viewportRef}
          className="viewport"
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDrag(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDrag(false);
            void selectFile(e.dataTransfer.files[0]);
          }}
        >
          {model ? (
            <ViewerErrorBoundary>
              <ModelViewer
                ref={viewer}
                model={showModel ? model : null}
                printer={printer}
                transform={transform}
                color={material.color}
                mode={mode}
                showGrid={showGrid}
                showAxes={showAxes}
                showVolume={showVolume}
                orthographic={ortho}
                background={settings.theme === "dark" ? "#10131a" : "#e7eaf0"}
                bounds={transformedAnalysis?.bounds ?? null}
                useModelColors={useModelColors}
              />
            </ViewerErrorBoundary>
          ) : (
            <EmptyUploadState onSelect={() => fileInput.current?.click()} />
          )}
          {drag && <div className="drop">Release to inspect model</div>}
          {(loading || analyzing) && (
            <div className="loading" role="status">
              {loading ? "Loading model…" : "Analysing transformed geometry…"}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X />
              </button>
            </div>
          )}
          {model && <ViewerToolbar active={activePreset} fullscreen={isFullscreen} onView={(preset) => { setActivePreset(preset); viewer.current?.view(preset); }} onFit={() => viewer.current?.view("isometric")} onReset={() => viewer.current?.reset()} onFullscreen={toggleFullscreen} />}
        </section>
        <aside ref={rightDrawerRef} className={`right ${rightOpen ? "open" : ""}`} role={compactLayout ? "dialog" : undefined} aria-modal={compactLayout && rightOpen ? "true" : undefined} aria-label="Estimate and quotation" aria-hidden={compactLayout && !rightOpen ? "true" : undefined} inert={compactLayout && !rightOpen}>
          <div className="drawer-topbar mobile">
            <strong data-drawer-heading tabIndex={-1}>Estimate & quotation</strong>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="Estimate panel" onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const tabs = ["model", "estimate", "pricing", "quotation"] as const;
            const index = tabs.indexOf(activeTab);
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            setActiveTab(tabs[next]!);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}>
            {(["model", "estimate", "pricing", "quotation"] as const).map((tab) => <button key={tab} role="tab" tabIndex={activeTab === tab ? 0 : -1} aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}
          </div>
          {model && <p className={fit.fits ? "success fit-banner" : "warning fit-banner"}>{fit.fits ? "Fits selected printer." : `Does not fit: ${fit.violations.map((v) => `${v.side} by ${v.amountMm.toFixed(2)} mm`).join(", ")}.`}</p>}
          <section hidden={activeTab !== "model"}>
            <h2>Model information</h2>
            {model ? <div className="stats">
              <span>
                Dimensions
                <b>
                  {dimensions.width.toFixed(1)} × {dimensions.depth.toFixed(1)}{" "}
                  × {dimensions.height.toFixed(1)} mm
                </b>
              </span>
              <span>
                Triangles
                <b>{model?.analysis.triangles.toLocaleString() ?? "—"}</b>
              </span>
              <span>
                Surface area
                <b>
                  {model
                    ? `${transformedAnalysis?.surfaceAreaCm2.toFixed(2)} cm²`
                    : "—"}
                </b>
              </span>
              <span>
                Enclosed volume
                <b>
                  {model
                    ? `${transformedAnalysis?.volumeCm3.toFixed(2)} cm³`
                    : "—"}
                </b>
              </span>
            </div> : <p className="muted">Upload a model to view dimensions, topology, and printer fit.</p>}
            {model && !transformedAnalysis?.diagnostics.volumeReliable && (
              <p className="warning">
                Volume may be inaccurate.{" "}
                {transformedAnalysis?.diagnostics.warnings.join(" ") ||
                  "Analysis is still pending."}
              </p>
            )}
            {!model ? (
              <p className="muted">Upload a model to check printer fit.</p>
            ) : (
              <p className={fit.fits ? "success" : "warning"}>
                {fit.fits
                  ? "Fits selected printer."
                  : `Does not fit: ${fit.violations.map((v) => `${v.side} by ${v.amountMm.toFixed(2)} mm`).join(", ")}.`}
              </p>
            )}
          </section>
          <section hidden={activeTab !== "model"}>
            <h2>Transform</h2>
            <fieldset className="control-fieldset" disabled={!model}>
            <div className="grid3">
              {(["X", "Y", "Z"] as const).map((a, i) => (
                <NumberField
                  key={a}
                  label={`Position ${a}`}
                  value={transform.position[i] ?? 0}
                  min={-10000}
                  onChange={(v) =>
                    setTransform((t) => ({
                      ...t,
                      position: t.position.map((x, j) => (j === i ? v : x)) as [
                        number,
                        number,
                        number,
                      ],
                    }))
                  }
                />
              ))}
            </div>
            <NumberField
              label="Uniform scale (%)"
              value={transform.scale[0] * 100}
              min={0.01}
              max={100000}
              onChange={(v) =>
                setTransform((t) => ({
                  ...t,
                  scale: [v / 100, v / 100, v / 100],
                }))
              }
            />
            <label className="toggle">
              <span>Advanced non-uniform scale</span>
              <input
                type="checkbox"
                checked={advancedScale}
                onChange={(e) => setAdvancedScale(e.target.checked)}
              />
            </label>
            {advancedScale && (
              <div className="grid3">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                  <NumberField
                    key={axis}
                    label={`Scale ${axis} (%)`}
                    value={(transform.scale[index] ?? 1) * 100}
                    min={0.01}
                    max={100000}
                    onChange={(value) =>
                      setTransform((t) => ({
                        ...t,
                        scale: t.scale.map((current, i) =>
                          i === index ? value / 100 : current,
                        ) as [number, number, number],
                      }))
                    }
                  />
                ))}
              </div>
            )}
            <div className="grid3">
              {(["X", "Y", "Z"] as const).map((axis, index) => (
                <NumberField
                  key={axis}
                  label={`Rotation ${axis} (°)`}
                  value={transform.rotation[index] ?? 0}
                  min={-3600}
                  onChange={(value) =>
                    setTransform((t) => ({
                      ...t,
                      rotation: t.rotation.map((current, i) =>
                        i === index ? value : current,
                      ) as [number, number, number],
                    }))
                  }
                />
              ))}
            </div>
            <div className="row">
              <button
                disabled={!model}
                onClick={() =>
                  setTransform((t) => ({
                    ...t,
                    position: [0, 0, t.position[2]],
                  }))
                }
              >
                Centre on plate
              </button>
              <button
                disabled={!model}
                onClick={() =>
                  transformedAnalysis &&
                  setTransform((t) => ({
                    ...t,
                    position: [
                      t.position[0],
                      t.position[1],
                      t.position[2] - transformedAnalysis.bounds.min[2],
                    ],
                  }))
                }
              >
                Place on build plate
              </button>
            </div>
            <button disabled={!model} onClick={scaleToFit}><Focus /> Scale to fit printer</button>
            <button onClick={() => setTransform(initialTransform)}>
              <RotateCcw /> Reset transform
            </button>
            </fieldset>
          </section>
          <section hidden={activeTab !== "estimate"}>
            <h2>Print estimate</h2>
            <div className="segmented">
              <button
                className={estimating === "manual" ? "active" : ""}
                aria-pressed={estimating === "manual"}
                onClick={() => setEstimating("manual")}
              >
                Manual · recommended
              </button>
              <button
                className={estimating === "quick" ? "active" : ""}
                aria-pressed={estimating === "quick"}
                onClick={() => setEstimating("quick")}
              >
                Quick estimate
              </button>
            </div>
            {estimating === "manual" ? (
              <>
                <NumberField
                  label="Slicer filament (g)"
                  value={filament}
                  onChange={setFilament}
                />
                <div className="grid2">
                  <NumberField
                    label="Print hours"
                    value={hours}
                    onChange={setHours}
                  />
                  <NumberField
                    label="Minutes"
                    value={minutes}
                    onChange={setMinutes}
                    min={0}
                    max={59}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="warning">
                  Preliminary estimate only. Actual filament usage and print
                  time may differ after slicing.
                </p>
                {model && !transformedAnalysis?.diagnostics.volumeReliable && (
                  <label className="warning">
                    <input
                      type="checkbox"
                      checked={unreliableAcknowledged}
                      onChange={(e) =>
                        setUnreliableAcknowledged(e.target.checked)
                      }
                    />{" "}
                    I understand the geometry-derived volume is unreliable and
                    accept using it for this preliminary estimate.
                  </label>
                )}
                <div className="grid2">
                  <NumberField
                    label="Infill (%)"
                    value={infill}
                    onChange={setInfill}
                    max={100}
                  />
                  <NumberField
                    label="Shell contribution multiplier (approx.)"
                    value={shell}
                    onChange={setShell}
                  />
                  <NumberField
                    label="Support (%)"
                    value={support}
                    onChange={setSupport}
                    max={500}
                  />
                  <NumberField
                    label="Waste (%)"
                    value={waste}
                    onChange={setWaste}
                    max={100}
                  />
                  <NumberField
                    label="Flow (g/hour)"
                    value={flow}
                    onChange={setFlow}
                    min={0.01}
                  />
                </div>
                <p>
                  <b>{auto.filamentGrams.toFixed(1)} g</b> ·{" "}
                  {auto.printHours.toFixed(2)} hours
                </p>
              </>
            )}
          </section>
          <section hidden={activeTab !== "pricing"}>
            <h2>Pricing</h2>
            <div className="grid2">
              <NumberField
                label="Labor minutes"
                value={laborMinutes}
                onChange={setLaborMinutes}
              />
              <NumberField
                label="Additional parts"
                value={parts}
                onChange={setParts}
              />
              <NumberField
                label="Electricity / kWh"
                value={settings.electricity}
                onChange={(v) => updateSetting("electricity", v)}
              />
              <NumberField
                label="Labor / hour"
                value={settings.laborRate}
                onChange={(v) => updateSetting("laborRate", v)}
              />
              <NumberField
                label="Annual maintenance"
                value={settings.maintenance}
                onChange={(v) => updateSetting("maintenance", v)}
              />
              <NumberField
                label="Estimated annual print hours"
                value={settings.annualHours}
                min={0.01}
                onChange={(v) => updateSetting("annualHours", v)}
              />
              <NumberField
                label="Buffer (%)"
                value={settings.buffer}
                onChange={(v) => updateSetting("buffer", v)}
                max={1000}
              />
              <NumberField
                label="Profit markup (%)"
                value={settings.markup}
                onChange={(v) => updateSetting("markup", v)}
                max={1000}
              />
              <NumberField
                label="Tax (%)"
                value={settings.tax}
                onChange={(v) => updateSetting("tax", v)}
                max={100}
              />
              <NumberField
                label="Quantity"
                value={quantity}
                onChange={(v) => setQuantity(Math.max(1, Math.floor(v)))}
                min={1}
              />
            </div>
            <label className="toggle">
              <span>Apply tax</span>
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
              />
            </label>
            <label className="field">
              <span>Currency</span>
              <select
                value={settings.currency}
                onChange={(e) =>
                  updateSetting(
                    "currency",
                    e.target.value as Settings["currency"],
                  )
                }
              >
                {["LKR", "USD", "EUR", "GBP", "AUD"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <p className="muted">
              Currency changes labels only; no exchange-rate conversion is
              performed.
            </p>
            <div className="breakdown">
              {[
                ["Material", pricing.materialCost],
                ["Labor", pricing.laborCost],
                ["Electricity", pricing.electricityCost],
                ["Maintenance", pricing.maintenanceCost],
                ["Base cost", pricing.baseCost],
                ["Buffer", pricing.bufferAmount],
                ["Buffered cost", pricing.bufferedCost],
                ["Profit markup", pricing.profitAmount],
                ["Selling price", pricing.sellingPrice],
                ["Tax", pricing.taxAmount],
                ["Final unit price", pricing.unitFinalPrice],
              ].map(([l, v]) => (
                <span key={String(l)}>
                  {l}
                  <b>{money(Number(v), settings.currency)}</b>
                </span>
              ))}
              <strong>
                Total × {quantity}
                <b>{money(pricing.totalPrice, settings.currency)}</b>
              </strong>
            </div>
          </section>
          <section hidden={activeTab !== "quotation"}>
            <h2>Quotation</h2>
            <label className="field">
              <span>Customer</span>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Email or phone</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Project</span>
              <input
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Valid until (optional)</span>
              <input
                type="date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
              />
            </label>
            <button
              className="primary wide"
              disabled={
                !model ||
                !transformedAnalysis ||
                (estimating === "quick" &&
                  !transformedAnalysis.diagnostics.volumeReliable &&
                  !unreliableAcknowledged)
              }
              onClick={() =>
                document.querySelector('[aria-invalid="true"]')
                  ? setError(
                      "Correct invalid numeric fields before generating a quotation.",
                    )
                  : model &&
                    transformedAnalysis &&
                    void downloadQuotation({
                      customer,
                      contact,
                      project,
                      notes,
                      validityDate,
                      estimationAssumptions:
                        estimating === "quick"
                          ? {
                              solidVolumeCm3: transformedAnalysis.volumeCm3,
                              density: material.density,
                              infillPercent: infill,
                              shellContributionMultiplier: shell,
                              supportPercent: support,
                              wastePercent: waste,
                              flowRateGPerHour: flow,
                            }
                          : undefined,
                      model,
                      analysis: transformedAnalysis,
                      fitSummary: fit.fits
                        ? "Fits selected printer"
                        : fit.violations
                            .map((v) => `${v.side} ${v.amountMm.toFixed(2)} mm`)
                            .join(", "),
                      material,
                      printer,
                      pricing,
                      currency: settings.currency,
                      filament: used,
                      hours: printHours,
                      quantity,
                      source:
                        estimating === "manual"
                          ? "Manual slicer values"
                          : "Quick estimation",
                      screenshot: viewer.current?.screenshot(),
                    })
                      .then((result) => {
                        if (!result.screenshotIncluded)
                          setError(
                            "Quotation downloaded, but the model screenshot could not be embedded.",
                          );
                      })
                      .catch(() =>
                        setError("PDF quotation could not be generated."),
                      )
              }
            >
              <Download /> Download PDF quotation
            </button>
          </section>
          <section hidden={activeTab !== "quotation"}>
            <h2>Settings</h2>
            <div className="row">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(settings, null, 2)], {
                    type: "application/json",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "printscope-settings.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 0);
                }}
              >
                Export JSON
              </button>
              <label className="button">
                Import JSON
                <input
                  className="sr-only"
                  type="file"
                  accept="application/json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void f
                        .text()
                        .then((raw) => {
                          const next = importSettings(raw);
                          setSettings(next);
                          setPrinterId(
                            next.printers.some((p) => p.id === printerId)
                              ? printerId
                              : next.printers[0]!.id,
                          );
                          setMaterialId(
                            next.materials.some((m) => m.id === materialId)
                              ? materialId
                              : next.materials[0]!.id,
                          );
                        })
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Invalid settings",
                          ),
                        )
                        .finally(() => {
                          e.target.value = "";
                        });
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const next = resetSettings();
                  setSettings(next);
                  setPrinterId(next.printers[0]!.id);
                  setMaterialId(next.materials[0]!.id);
                }}
              >
                Restore defaults
              </button>
            </div>
          </section>
        </aside>
      </main>
      {help && (
        <Dialog title="Welcome to PrintScope" description="Upload or drop an STL or 3MF file. Drag to rotate, scroll or pinch to zoom, and right-drag to pan." onClose={() => { setHelp(false); localStorage.setItem("printscope.help.seen", "1"); }} returnFocus={helpButtonRef}>
            <p>
              PrintScope analyses geometry and previews build-volume fit; it
              does not slice models or generate G-code. For quotations, manual
              filament and duration values from your slicer are recommended.
              Quick estimates expose every assumption but remain preliminary.
            </p>
            <p>
              <b>Private by design:</b> model files, customer details, settings,
              screenshots, and PDFs stay in your browser.
            </p>
            <button
              className="primary"
              onClick={() => {
                setHelp(false);
                localStorage.setItem("printscope.help.seen", "1");
              }}
            >
              Start exploring
            </button>
        </Dialog>
      )}
      {profileEditor && <ProfileDialog state={profileEditor} onClose={() => setProfileEditor(null)} onSave={saveProfile} />}
      {deleteProfile && <ConfirmDialog name={deleteProfile === "printer" ? printer.name : material.name} onClose={() => setDeleteProfile(null)} onConfirm={() => { if (deleteProfile === "printer") deletePrinterProfile(); else deleteMaterialProfile(); setDeleteProfile(null); }} />}
    </div>
  );
}
export default App;
