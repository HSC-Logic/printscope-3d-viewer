import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const analysis = {
  dimensions: { width: 10, depth: 10, height: 10 }, triangles: 4, meshes: 1,
  surfaceAreaCm2: 2.4, volumeCm3: 0.17, boundingVolumeCm3: 1,
  bounds: { min: [-5, -5, 0], max: [5, 5, 10] } as { min: [number, number, number]; max: [number, number, number] },
  diagnostics: { volumeReliable: true, boundaryEdgeCount: 0, nonManifoldEdgeCount: 0, degenerateTriangleCount: 0, invalidTriangleCount: 0, warnings: [] },
};
const loadedModel = { name: "a-very-long-model-file-name-for-layout-testing.stl", extension: "stl" as const, size: 100, geometries: [], analysis, normalization: [0, 0, 0] as [number, number, number], meshNames: [], hasModelColors: false, meshMaterials: [] };

vi.mock("./components/viewer/ModelViewer", () => ({ ModelViewer: () => <div data-testid="viewer" /> }));
vi.mock("./utils/pdfQuotation", () => ({ downloadQuotation: vi.fn() }));
vi.mock("./loaders/loadModel", () => ({ loadModel: vi.fn(async () => loadedModel), disposeModel: vi.fn() }));
vi.mock("./geometry/analyzeOffMain", () => ({ analyzeOffMain: vi.fn(async () => analysis) }));

describe("PrintScope responsive user flows", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  });

  it("renders a dominant empty state without model-only controls or fake statistics", () => {
    localStorage.setItem("printscope.help.seen", "1");
    render(<App />);
    expect(screen.getByTestId("empty-upload-state")).toBeInTheDocument();
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("viewer-toolbar")).not.toBeInTheDocument();
    expect(screen.getByText("Upload a model to inspect and transform it.")).toBeInTheDocument();
    expect(screen.getByLabelText("Position X")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Download PDF quotation/, hidden: true })).toBeDisabled();
    expect(screen.queryByText(/0\.0 × 0\.0 × 0\.0/)).not.toBeInTheDocument();
  });

  it("shows the model viewer and toolbar after loading", async () => {
    localStorage.setItem("printscope.help.seen", "1");
    render(<App />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept=".stl,.3mf"]')!;
    fireEvent.change(input, { target: { files: [new File(["solid"], "sample.stl")] } });
    await waitFor(() => expect(screen.getByTestId("viewer-toolbar")).toBeInTheDocument());
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-upload-state")).not.toBeInTheDocument();
  });

  it("updates the persisted theme class and accessible action state", () => {
    localStorage.setItem("printscope.help.seen", "1");
    render(<App />);
    const theme = screen.getByRole("button", { name: "Switch to light theme" });
    fireEvent.click(theme);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("exposes all compact header actions from More", () => {
    localStorage.setItem("printscope.help.seen", "1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: /Reset camera/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Screenshot/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Fullscreen/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Theme/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Help/ })).toBeInTheDocument();
  });

  it("allows only one drawer, closes with Escape, and restores opener focus", async () => {
    localStorage.setItem("printscope.help.seen", "1");
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
    render(<App />);
    const left = screen.getByRole("button", { name: "Open model settings" });
    const right = screen.getByRole("button", { name: "Open estimate and quotation" });
    fireEvent.click(left);
    expect(screen.getByRole("dialog", { name: "Model settings" })).toBeInTheDocument();
    fireEvent.click(right);
    expect(screen.queryByRole("dialog", { name: "Model settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Estimate and quotation" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(right).toHaveFocus());
  });

  it("edits profiles in an application dialog without browser prompts", async () => {
    localStorage.setItem("printscope.help.seen", "1");
    const prompt = vi.spyOn(window, "prompt");
    const confirm = vi.spyOn(window, "confirm");
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Duplicate / add" })[0]!);
    expect(screen.getByRole("dialog", { name: "Add printer profile" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "QA Printer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "QA Printer" })).toBeInTheDocument());
    expect(prompt).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps quotation values when changing right-panel tabs", () => {
    localStorage.setItem("printscope.help.seen", "1");
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Quotation" }));
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("tab", { name: "Model" }));
    fireEvent.click(screen.getByRole("tab", { name: "Quotation" }));
    expect(screen.getByLabelText("Customer")).toHaveValue("Ada Lovelace");
  });
});
