import type { Dimensions, PrinterProfile } from "../types";
export function checkPrinterFit(d: Dimensions, p: PrinterProfile) {
  const overflow = (["width", "depth", "height"] as const).filter(
    (k) => d[k] > p.build[k] + 1e-6,
  );
  return { fits: overflow.length === 0, overflow };
}
