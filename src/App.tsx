import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Focus,
  HelpCircle,
  Image,
  Maximize,
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
import {
  loadSettings,
  saveSettings,
  defaults,
  importSettings,
  type Settings,
} from "./storage/settingsStorage";
import { downloadQuotation } from "./utils/pdfQuotation";
import type { LoadedModel, TransformState } from "./types";
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number | "any";
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
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
  const viewer = useRef<ViewerHandle>(null),
    fileInput = useRef<HTMLInputElement>(null);
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
    saveSettings(settings);
  }, [settings]);
  useEffect(() => () => disposeModel(model), [model]);
  const dimensions = useMemo(
    () =>
      model
        ? {
            width:
              model.analysis.dimensions.width * Math.abs(transform.scale[0]),
            depth:
              model.analysis.dimensions.depth * Math.abs(transform.scale[1]),
            height:
              model.analysis.dimensions.height * Math.abs(transform.scale[2]),
          }
        : { width: 0, depth: 0, height: 0 },
    [model, transform.scale],
  );
  const fit = checkPrinterFit(dimensions, printer);
  const auto = useMemo(
    () =>
      quickEstimate({
        volumeCm3:
          (model?.analysis.volumeCm3 ?? 0) *
          Math.abs(
            transform.scale[0] * transform.scale[1] * transform.scale[2],
          ),
        density: material.density,
        infillPercent: infill,
        shellFactor: shell,
        supportPercent: support,
        wastePercent: waste,
        flowRateGPerHour: flow,
      }),
    [
      model,
      transform.scale,
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
    setLoading(true);
    setError("");
    try {
      const next = await loadModel(file);
      disposeModel(model);
      setModel(next);
      const d = next.analysis.dimensions;
      setTransform({ ...initialTransform, position: [0, 0, d.height / 2] });
      setProject(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The model could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  function downloadImage() {
    try {
      const url = viewer.current?.screenshot();
      if (!url) throw new Error();
      const a = document.createElement("a");
      a.href = url;
      a.download = "PrintScope-model.png";
      a.click();
    } catch {
      setError("Screenshot could not be created.");
    }
  }
  function scaleToFit() {
    if (!model) return;
    const ratio =
      Math.min(
        printer.build.width / model.analysis.dimensions.width,
        printer.build.depth / model.analysis.dimensions.depth,
        printer.build.height / model.analysis.dimensions.height,
      ) * 0.98;
    setTransform({
      ...initialTransform,
      position: [0, 0, (model.analysis.dimensions.height * ratio) / 2],
      scale: [ratio, ratio, ratio],
    });
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
          className="mobile"
          aria-label="Open model settings"
          onClick={() => setLeftOpen(true)}
        >
          <Menu />
        </button>
        <div className="logo">
          <Box /> <span>PrintScope</span>
          <small>3D Viewer & Cost Estimator</small>
        </div>
        <div className="toolbar">
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".stl,.3mf"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              void selectFile(e.target.files?.[0])
            }
          />
          <button
            className="primary"
            onClick={() => fileInput.current?.click()}
          >
            <FileUp /> {model ? "Replace" : "Upload"} Model
          </button>
          <button title="Reset view" onClick={() => viewer.current?.reset()}>
            <Focus />
          </button>
          <button title="Screenshot" disabled={!model} onClick={downloadImage}>
            <Image />
          </button>
          <button
            title="Full screen"
            onClick={() => void document.documentElement.requestFullscreen?.()}
          >
            <Maximize />
          </button>
          <button
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
          <button title="Help" onClick={() => setHelp(true)}>
            <HelpCircle />
          </button>
        </div>
        <button
          className="mobile"
          aria-label="Open estimate and quotation"
          onClick={() => setRightOpen(true)}
        >
          <ChevronLeft />
        </button>
      </header>
      <main>
        <aside className={`left ${leftOpen ? "open" : ""}`}>
          <button
            className="drawer-close mobile"
            onClick={() => setLeftOpen(false)}
          >
            <X />
          </button>
          <h2>Model</h2>
          {model ? (
            <div className="file-card">
              <b>{model.name}</b>
              <span>
                {(model.size / 1048576).toFixed(2)} MB ·{" "}
                {model.extension.toUpperCase()}
              </span>
            </div>
          ) : (
            <p className="muted">No model loaded.</p>
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
          <NumberField
            label="Density (g/cm³)"
            value={material.density}
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
          <h2>Display</h2>
          <label className="field">
            <span>Render mode</span>
            <select
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
                type="checkbox"
                checked={Boolean(v)}
                onChange={(e) => set(e.target.checked)}
              />
            </label>
          ))}
        </aside>
        <section
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
            />
          ) : (
            <button
              className="empty"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp />
              <b>Drop your STL or 3MF here</b>
              <span>or choose a file · maximum 100 MB</span>
              <small>Your model never leaves this browser.</small>
            </button>
          )}
          {drag && <div className="drop">Release to inspect model</div>}
          {loading && (
            <div className="loading" role="status">
              Loading and analysing geometry…
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>
                <X />
              </button>
            </div>
          )}
          <div className="viewbar">
            <button onClick={() => viewer.current?.reset()}>
              <Camera /> Reset camera
            </button>
            <button disabled={!model} onClick={scaleToFit}>
              <Focus /> Scale to fit printer
            </button>
          </div>
        </section>
        <aside className={`right ${rightOpen ? "open" : ""}`}>
          <button
            className="drawer-close mobile"
            onClick={() => setRightOpen(false)}
          >
            <ChevronRight />
          </button>
          <section>
            <h2>Model information</h2>
            <div className="stats">
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
                    ? `${model.analysis.surfaceAreaCm2.toFixed(2)} cm²`
                    : "—"}
                </b>
              </span>
              <span>
                Enclosed volume
                <b>
                  {model ? `${model.analysis.volumeCm3.toFixed(2)} cm³` : "—"}
                </b>
              </span>
            </div>
            {model && !model.analysis.volumeReliable && (
              <p className="warning">
                ⚠ Volume may be inaccurate: the mesh may be open, inconsistently
                wound, or degenerate.
              </p>
            )}
            <p className={fit.fits ? "success" : "warning"}>
              {fit.fits
                ? "✓ Fits selected printer"
                : `⚠ Does not fit: ${fit.overflow.join(", ")} overflow`}
            </p>
          </section>
          <section>
            <h2>Transform</h2>
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
              onChange={(v) =>
                setTransform((t) => ({
                  ...t,
                  scale: [v / 100, v / 100, v / 100],
                  position: [
                    t.position[0],
                    t.position[1],
                    model ? (model.analysis.dimensions.height * v) / 200 : 0,
                  ],
                }))
              }
            />
            <button
              onClick={() =>
                setTransform(
                  model
                    ? {
                        ...initialTransform,
                        position: [0, 0, model.analysis.dimensions.height / 2],
                      }
                    : initialTransform,
                )
              }
            >
              <RotateCcw /> Reset transform
            </button>
          </section>
          <section>
            <h2>Print estimate</h2>
            <div className="segmented">
              <button
                className={estimating === "manual" ? "active" : ""}
                onClick={() => setEstimating("manual")}
              >
                Manual · recommended
              </button>
              <button
                className={estimating === "quick" ? "active" : ""}
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
                  />
                </div>
              </>
            ) : (
              <>
                <p className="warning">
                  Preliminary estimate only. Actual filament usage and print
                  time may differ after slicing.
                </p>
                <div className="grid2">
                  <NumberField
                    label="Infill (%)"
                    value={infill}
                    onChange={setInfill}
                  />
                  <NumberField
                    label="Shell factor"
                    value={shell}
                    onChange={setShell}
                  />
                  <NumberField
                    label="Support (%)"
                    value={support}
                    onChange={setSupport}
                  />
                  <NumberField
                    label="Waste (%)"
                    value={waste}
                    onChange={setWaste}
                  />
                  <NumberField
                    label="Flow (g/hour)"
                    value={flow}
                    onChange={setFlow}
                  />
                </div>
                <p>
                  <b>{auto.filamentGrams.toFixed(1)} g</b> ·{" "}
                  {auto.printHours.toFixed(2)} hours
                </p>
              </>
            )}
          </section>
          <section>
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
                label="Buffer (%)"
                value={settings.buffer}
                onChange={(v) => updateSetting("buffer", v)}
              />
              <NumberField
                label="Profit markup (%)"
                value={settings.markup}
                onChange={(v) => updateSetting("markup", v)}
              />
              <NumberField
                label="Tax (%)"
                value={settings.tax}
                onChange={(v) => updateSetting("tax", v)}
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
            <div className="breakdown">
              {[
                ["Material", pricing.materialCost],
                ["Labor", pricing.laborCost],
                ["Electricity", pricing.electricityCost],
                ["Maintenance", pricing.maintenanceCost],
                ["Base cost", pricing.baseCost],
                ["Buffer", pricing.bufferAmount],
                ["Profit markup", pricing.profitAmount],
                ["Tax", pricing.taxAmount],
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
          <section>
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
            <button
              className="primary wide"
              disabled={!model}
              onClick={() =>
                model &&
                void downloadQuotation({
                  customer,
                  contact,
                  project,
                  notes,
                  model,
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
                }).catch(() =>
                  setError("PDF quotation could not be generated."),
                )
              }
            >
              <Download /> Download PDF quotation
            </button>
          </section>
          <section>
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
                  URL.revokeObjectURL(a.href);
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
                        .then((raw) => setSettings(importSettings(raw)))
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Invalid settings",
                          ),
                        );
                  }}
                />
              </label>
              <button onClick={() => setSettings(defaults())}>
                Restore defaults
              </button>
            </div>
          </section>
        </aside>
      </main>
      {help && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="modal-x"
              aria-label="Close help"
              onClick={() => {
                setHelp(false);
                localStorage.setItem("printscope.help.seen", "1");
              }}
            >
              <X />
            </button>
            <h1 id="help-title">Welcome to PrintScope</h1>
            <p>
              Upload or drop an STL or 3MF file. Drag to rotate, scroll or pinch
              to zoom, and right-drag to pan.
            </p>
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
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
