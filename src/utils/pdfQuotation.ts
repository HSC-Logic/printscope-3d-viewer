import type {
  GeometryAnalysis,
  LoadedModel,
  MaterialProfile,
  PrinterProfile,
} from "../types";
import type { PricingResult } from "../pricing/calculate3DPrintPricing";
export interface QuoteData {
  customer: string;
  contact: string;
  project: string;
  notes: string;
  model: LoadedModel;
  analysis: GeometryAnalysis;
  fitSummary: string;
  material: MaterialProfile;
  printer: PrinterProfile;
  pricing: PricingResult;
  currency: string;
  filament: number;
  hours: number;
  quantity: number;
  source: "Manual slicer values" | "Quick estimation";
  validityDate?: string;
  estimationAssumptions?: Record<string, number>;
  screenshot?: string;
}
export function buildQuotationSnapshot(q: QuoteData) {
  const d = q.analysis.dimensions;
  return Object.freeze({
    filename: q.model.name,
    dimensions: `${d.width.toFixed(1)} × ${d.depth.toFixed(1)} × ${d.height.toFixed(1)} mm`,
    volumeCm3: q.analysis.volumeCm3,
    fitSummary: q.fitSummary,
    quantity: q.quantity,
    source: q.source,
    currency: q.currency,
    tax: q.pricing.taxAmount,
    unitPrice: q.pricing.unitFinalPrice,
    totalPrice: q.pricing.totalPrice,
    assumptions: { ...(q.estimationAssumptions ?? {}) },
  });
}
export async function downloadQuotation(q: QuoteData) {
  const snapshot = buildQuotationSnapshot(q);
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const date = new Date();
  const ref = `PS-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  doc.setFontSize(22);
  doc.text("PrintScope", 14, 18);
  doc.setFontSize(11);
  doc.text(`QUOTATION ${ref}`, 14, 27);
  const safe = (value: string, max = 160) => value.trim().slice(0, max) || "—";
  doc.text(
    `Date: ${date.toLocaleDateString()}   Customer: ${safe(q.customer, 60)}   Contact: ${safe(q.contact, 60)}`,
    14,
    35,
    { maxWidth: 180 },
  );
  doc.text(`Project: ${safe(q.project || q.model.name, 100)}`, 14, 42, {
    maxWidth: 180,
  });
  if (q.validityDate)
    doc.text(`Valid until: ${safe(q.validityDate, 30)}`, 140, 27);
  autoTable(doc, {
    startY: 48,
    head: [["Production details", "Value"]],
    body: [
      ["Model", snapshot.filename],
      ["Dimensions", snapshot.dimensions],
      ["Printer", q.printer.name],
      ["Material", q.material.name],
      ["Printer fit", q.fitSummary],
      ["Transformed volume", `${q.analysis.volumeCm3.toFixed(2)} cm³`],
      ["Quantity", String(q.quantity)],
      ["Filament", `${q.filament.toFixed(1)} g (${q.source})`],
      ["Print duration", `${q.hours.toFixed(2)} h (${q.source})`],
      ...Object.entries(snapshot.assumptions).map(([name, value]) => [
        name,
        String(value),
      ]),
    ],
  });
  autoTable(doc, {
    head: [["Pricing", "Amount"]],
    body: (
      [
        ["Material", q.pricing.materialCost],
        ["Labor", q.pricing.laborCost],
        ["Electricity", q.pricing.electricityCost],
        ["Maintenance", q.pricing.maintenanceCost],
        [
          "Additional parts",
          q.pricing.baseCost -
            q.pricing.materialCost -
            q.pricing.laborCost -
            q.pricing.electricityCost -
            q.pricing.maintenanceCost,
        ],
        ["Buffer", q.pricing.bufferAmount],
        ["Profit markup", q.pricing.profitAmount],
        ["Tax", q.pricing.taxAmount],
        ["Unit price", q.pricing.unitFinalPrice],
        ["Total", q.pricing.totalPrice],
      ] as Array<[string, number]>
    ).map(([a, b]) => [a, `${q.currency} ${b.toFixed(2)}`]),
  });
  let y =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 180) + 10;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  doc.text(
    doc.splitTextToSize(
      safe(
        q.notes || "Quotation valid subject to final sliced model review.",
        500,
      ),
      180,
    ),
    14,
    y,
  );
  doc.text(
    "Estimates are not slicing results. Uploaded model and quotation data remain in this browser.",
    14,
    y + 7,
  );
  let screenshotIncluded = true;
  if (q.screenshot)
    try {
      doc.addImage(q.screenshot, "PNG", 135, 45, 60, 55);
    } catch {
      screenshotIncluded = false;
    }
  doc.save(`PrintScope-Quotation-${ref}.pdf`);
  return { reference: ref, screenshotIncluded };
}
