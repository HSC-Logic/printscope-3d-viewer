import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
vi.mock("./components/viewer/ModelViewer", () => ({
  ModelViewer: () => <div data-testid="viewer" />,
}));
vi.mock("./utils/pdfQuotation", () => ({ downloadQuotation: vi.fn() }));
describe("PrintScope user flows", () => {
  beforeEach(() => localStorage.clear());
  it("shows a truthful empty model and fit state", () => {
    render(<App />);
    expect(screen.getByText("No model loaded.")).toBeInTheDocument();
    expect(
      screen.getByText("Upload a model to check printer fit."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Fits selected printer."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download PDF quotation/ }),
    ).toBeDisabled();
  });
  it("switches to preliminary quick estimation", () => {
    localStorage.setItem("printscope.help.seen", "1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Quick estimate" }));
    expect(screen.getByText(/Preliminary estimate only/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Shell contribution multiplier/),
    ).toBeInTheDocument();
  });
  it("closes the first-use dialog with Escape", () => {
    render(<App />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("duplicates and deletes a custom printer safely", () => {
    localStorage.setItem("printscope.help.seen", "1");
    const prompts = ["QA Printer", "220", "220", "270", "350", "80000"];
    vi.spyOn(window, "prompt").mockImplementation(
      () => prompts.shift() ?? null,
    );
    render(<App />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Duplicate / add" })[0]!,
    );
    expect(
      screen.getByRole("option", { name: "QA Printer" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete custom" })[0]!,
    );
    expect(
      screen.queryByRole("option", { name: "QA Printer" }),
    ).not.toBeInTheDocument();
  });
});
