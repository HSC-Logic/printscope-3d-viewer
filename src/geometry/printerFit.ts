import type { PrinterProfile, WorldBounds } from "../types";
export interface FitViolation {
  side: "left" | "right" | "front" | "back" | "below" | "above";
  amountMm: number;
}
export function checkPrinterFit(
  bounds: WorldBounds | null,
  p: PrinterProfile,
  tolerance = 0.001,
) {
  if (!bounds) return { fits: false, violations: [] as FitViolation[] };
  const [x0, y0, z0] = bounds.min,
    [x1, y1, z1] = bounds.max;
  const checks: [FitViolation["side"], number][] = [
    ["left", -p.build.width / 2 - x0],
    ["right", x1 - p.build.width / 2],
    ["front", -p.build.depth / 2 - y0],
    ["back", y1 - p.build.depth / 2],
    ["below", -z0],
    ["above", z1 - p.build.height],
  ];
  const violations = checks
    .filter(([, n]) => n > tolerance)
    .map(([side, amountMm]) => ({ side, amountMm }));
  return { fits: violations.length === 0, violations };
}
