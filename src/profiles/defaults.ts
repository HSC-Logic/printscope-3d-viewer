import type { MaterialProfile, PrinterProfile } from "../types";
export const printers: PrinterProfile[] = [
  {
    id: "ender-s1",
    name: "Creality Ender S1",
    build: { width: 220, depth: 220, height: 270 },
    powerW: 350,
    purchasePrice: 80000,
  },
  {
    id: "a1-mini",
    name: "Bambu Lab A1 Mini",
    build: { width: 180, depth: 180, height: 180 },
    powerW: 150,
    purchasePrice: 125000,
  },
];
export const materials: MaterialProfile[] = [
  ["pla", "PLA", 1.24, 5500, "#f97316", "General purpose"],
  ["petg", "PETG", 1.27, 6500, "#38bdf8", "Durable"],
  ["abs", "ABS", 1.04, 6200, "#94a3b8", "Heat resistant"],
  ["tpu", "TPU", 1.21, 8500, "#a78bfa", "Flexible"],
  ["asa", "ASA", 1.07, 7800, "#fbbf24", "UV resistant"],
].map(
  ([id, name, density, costPerKg, color, notes]) =>
    ({ id, name, density, costPerKg, color, notes }) as MaterialProfile,
);
