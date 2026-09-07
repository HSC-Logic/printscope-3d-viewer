import { describe, expect, it } from "vitest";
import { buildQuotationSnapshot, type QuoteData } from "./pdfQuotation";
describe("quotation snapshot", () => {
  it("freezes transformed values, quantity, source, currency and tax", () => {
    const q = {
      model: { name: "offset.stl" },
      analysis: {
        dimensions: { width: 20, depth: 30, height: 40 },
        volumeCm3: 24,
      },
      fitSummary: "right 2.00 mm",
      quantity: 3,
      source: "Quick estimation",
      currency: "LKR",
      pricing: { taxAmount: 10, unitFinalPrice: 110, totalPrice: 330 },
      estimationAssumptions: { infillPercent: 20 },
    } as unknown as QuoteData;
    const snapshot = buildQuotationSnapshot(q);
    expect(snapshot.dimensions).toBe("20.0 × 30.0 × 40.0 mm");
    expect(snapshot).toMatchObject({
      volumeCm3: 24,
      fitSummary: "right 2.00 mm",
      quantity: 3,
      source: "Quick estimation",
      currency: "LKR",
      tax: 10,
      unitPrice: 110,
      totalPrice: 330,
    });
    expect(snapshot.assumptions).toEqual({ infillPercent: 20 });
  });
});
