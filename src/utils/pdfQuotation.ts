import type { LoadedModel, MaterialProfile, PrinterProfile } from "../types";
import type { PricingResult } from "../pricing/calculate3DPrintPricing";
export interface QuoteData {
  customer: string;
  contact: string;
  project: string;
  notes: string;
  model: LoadedModel;
  material: MaterialProfile;
  printer: PrinterProfile;
  pricing: PricingResult;
  currency: string;
  filament: number;
  hours: number;
  quantity: number;
  source: "Manual slicer values" | "Quick estimation";
  screenshot?: string;
}
export async function downloadQuotation(q: QuoteData) {
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
  doc.text(
    `Date: ${date.toLocaleDateString()}   Customer: ${q.customer || "—"}   Contact: ${q.contact || "—"}`,
    14,
    35,
  );
  doc.text(`Project: ${q.project || q.model.name}`, 14, 42);
  const d = q.model.analysis.dimensions;
  autoTable(doc, {
    startY: 48,
    head: [["Production details", "Value"]],
    body: [
      ["Model", q.model.name],
      [
        "Dimensions",
        `${d.width.toFixed(1)} × ${d.depth.toFixed(1)} × ${d.height.toFixed(1)} mm`,
      ],
      ["Printer", q.printer.name],
      ["Material", q.material.name],
      ["Quantity", String(q.quantity)],
      ["Filament", `${q.filament.toFixed(1)} g (${q.source})`],
      ["Print duration", `${q.hours.toFixed(2)} h (${q.source})`],
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
  const y = 190;
  doc.setFontSize(9);
  doc.text(
    q.notes || "Quotation valid subject to final sliced model review.",
    14,
    y,
  );
  doc.text(
    "Estimates are not slicing results. Uploaded model and quotation data remain in this browser.",
    14,
    y + 7,
  );
  if (q.screenshot)
    try {
      doc.addImage(q.screenshot, "PNG", 135, 45, 60, 55);
    } catch {
      /* PDF remains valid if canvas image cannot be embedded */
    }
  doc.save(
    `PrintScope-Quotation-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${ref}.pdf`,
  );
}
