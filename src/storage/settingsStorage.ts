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
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      (value as { version: unknown }).version !== 1
    )
      return defaults();
    return { ...defaults(), ...(value as Settings) };
  } catch {
    return defaults();
  }
}
export const saveSettings = (s: Settings) =>
  localStorage.setItem(KEY, JSON.stringify(s));
export const resetSettings = () => {
  localStorage.removeItem(KEY);
  return defaults();
};
export function importSettings(raw: string): Settings {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new Error("Settings file is not valid JSON.");
  }
  if (
    !v ||
    typeof v !== "object" ||
    !("version" in v) ||
    (v as { version: unknown }).version !== 1
  )
    throw new Error("Unsupported or invalid settings format.");
  const merged = { ...defaults(), ...(v as Settings) };
  saveSettings(merged);
  return merged;
}
