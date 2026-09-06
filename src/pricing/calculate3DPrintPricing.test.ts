import { describe, expect, it } from "vitest";
import {
  calculate3DPrintPricing,
  type PricingInputs,
} from "./calculate3DPrintPricing";
const input: PricingInputs = {
  filamentCostPerKg: 5000,
  filamentUsedGrams: 100,
  printTimeHours: 2,
  laborMinutes: 30,
  laborRatePerHour: 600,
  printerPowerW: 200,
  electricityCostPerKwh: 50,
  annualMaintenanceCost: 12000,
  estimatedAnnualPrintHours: 1200,
  partsCost: 100,
  bufferPercent: 10,
  profitPercent: 20,
  taxEnabled: true,
  taxRate: 18,
  quantity: 2,
  currency: "LKR",
};
describe("3D print pricing", () => {
  it("calculates every cost stage and quantity", () => {
    const r = calculate3DPrintPricing(input);
    expect(r.materialCost).toBe(500);
    expect(r.laborCost).toBe(300);
    expect(r.electricityCost).toBe(20);
    expect(r.maintenanceCostPerHour).toBe(10);
    expect(r.maintenanceCost).toBe(20);
    expect(r.baseCost).toBe(940);
    expect(r.bufferAmount).toBe(94);
    expect(r.profitAmount).toBeCloseTo(206.8);
    expect(r.taxAmount).toBeCloseTo(223.344);
    expect(r.unitFinalPrice).toBeCloseTo(1464.144);
    expect(r.totalPrice).toBeCloseTo(2928.288);
  });
  it("supports zero variable costs", () => {
    const r = calculate3DPrintPricing({
      ...input,
      filamentUsedGrams: 0,
      printTimeHours: 0,
      laborMinutes: 0,
      partsCost: 0,
      bufferPercent: 0,
      profitPercent: 0,
      taxEnabled: false,
    });
    expect(r.totalPrice).toBe(0);
  });
  it("rejects invalid values and zero divisors", () => {
    expect(() =>
      calculate3DPrintPricing({ ...input, filamentUsedGrams: -1 }),
    ).toThrow();
    expect(() =>
      calculate3DPrintPricing({ ...input, partsCost: Infinity }),
    ).toThrow();
    expect(() =>
      calculate3DPrintPricing({ ...input, estimatedAnnualPrintHours: 0 }),
    ).toThrow();
    expect(() =>
      calculate3DPrintPricing({ ...input, quantity: 1.5 }),
    ).toThrow();
  });
});
