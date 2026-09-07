import { materials, printers } from "../profiles/defaults";
import type { Currency, MaterialProfile, PrinterProfile } from "../types";
export interface Settings {
  version: 1;
  theme: "light" | "dark";
  currency: Currency;
  printers: PrinterProfile[];
  materials: MaterialProfile[];
  electricity: number;
  laborRate: number;
  maintenance: number;
  annualHours: number;
  buffer: number;
  markup: number;
  tax: number;
}
export const defaults = (): Settings => ({
  version: 1,
  theme: "dark",
  currency: "LKR",
  printers: structuredClone(printers),
  materials: structuredClone(materials),
  electricity: 65,
  laborRate: 500,
  maintenance: 12000,
  annualHours: 1200,
  buffer: 10,
  markup: 25,
  tax: 0,
});
const KEY = "printscope.settings.v1";
const currencies: Currency[] = ["LKR", "USD", "EUR", "GBP", "AUD"];
const finite = (v: unknown, min = 0) =>
  typeof v === "number" && Number.isFinite(v) && v >= min;
const unique = (values: string[]) => new Set(values).size === values.length;
function isPrinter(v: unknown): v is PrinterProfile {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<PrinterProfile>;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    !!p.build &&
    finite(p.build.width, 0.001) &&
    finite(p.build.depth, 0.001) &&
    finite(p.build.height, 0.001) &&
    finite(p.powerW) &&
    finite(p.purchasePrice)
  );
}
function isMaterial(v: unknown): v is MaterialProfile {
  if (!v || typeof v !== "object") return false;
  const m = v as Partial<MaterialProfile>;
  return (
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.name === "string" &&
    m.name.trim().length > 0 &&
    finite(m.density, 0.001) &&
    finite(m.costPerKg) &&
    typeof m.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(m.color) &&
    typeof m.notes === "string"
  );
}
export function validateSettings(v: unknown): v is Settings {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<Settings>;
  return (
    s.version === 1 &&
    (s.theme === "light" || s.theme === "dark") &&
    currencies.includes(s.currency as Currency) &&
    Array.isArray(s.printers) &&
    s.printers.length > 0 &&
    s.printers.every(isPrinter) &&
    unique(s.printers.map((p) => p.id)) &&
    Array.isArray(s.materials) &&
    s.materials.length > 0 &&
    s.materials.every(isMaterial) &&
    unique(s.materials.map((m) => m.id)) &&
    finite(s.electricity) &&
    finite(s.laborRate) &&
    finite(s.maintenance) &&
    finite(s.annualHours, 0.001) &&
    finite(s.buffer) &&
    finite(s.markup) &&
    finite(s.tax)
  );
}
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const value: unknown = JSON.parse(raw);
    return validateSettings(value) ? value : defaults();
  } catch {
    return defaults();
  }
}
export const saveSettings = (s: Settings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
};
export const resetSettings = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* defaults are still returned */
  }
  return defaults();
};
export function importSettings(raw: string): Settings {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new Error("Settings file is not valid JSON.");
  }
  if (!validateSettings(v))
    throw new Error("Unsupported or invalid settings format.");
  if (!saveSettings(v))
    throw new Error("Settings are valid but browser storage is unavailable.");
  return v;
}
