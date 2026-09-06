import type { Currency } from "../types";
export interface PricingInputs {
  filamentCostPerKg: number;
  filamentUsedGrams: number;
  printTimeHours: number;
  laborMinutes: number;
  laborRatePerHour: number;
  printerPowerW: number;
  electricityCostPerKwh: number;
  annualMaintenanceCost: number;
  estimatedAnnualPrintHours: number;
  partsCost: number;
  bufferPercent: number;
  profitPercent: number;
  taxEnabled: boolean;
  taxRate: number;
  quantity: number;
  currency: Currency;
}
export interface PricingResult {
  materialCost: number;
  laborCost: number;
  electricityCost: number;
  maintenanceCostPerHour: number;
  maintenanceCost: number;
  baseCost: number;
  bufferAmount: number;
  bufferedCost: number;
  profitAmount: number;
  sellingPrice: number;
  taxAmount: number;
  unitFinalPrice: number;
  totalPrice: number;
}
export function calculate3DPrintPricing(i: PricingInputs): PricingResult {
  for (const [k, v] of Object.entries(i)) {
    if (typeof v === "number" && (!Number.isFinite(v) || v < 0))
      throw new Error(`${k} must be a finite, non-negative number`);
  }
  if (i.estimatedAnnualPrintHours <= 0)
    throw new Error("Estimated annual print hours must be greater than zero");
  if (!Number.isInteger(i.quantity) || i.quantity < 1)
    throw new Error("Quantity must be a positive integer");
  const materialCost = (i.filamentUsedGrams / 1000) * i.filamentCostPerKg;
  const laborCost = (i.laborMinutes / 60) * i.laborRatePerHour;
  const electricityCost =
    (i.printerPowerW / 1000) * i.printTimeHours * i.electricityCostPerKwh;
  const maintenanceCostPerHour =
    i.annualMaintenanceCost / i.estimatedAnnualPrintHours;
  const maintenanceCost = maintenanceCostPerHour * i.printTimeHours;
  const baseCost =
    materialCost + laborCost + electricityCost + maintenanceCost + i.partsCost;
  const bufferAmount = (baseCost * i.bufferPercent) / 100;
  const bufferedCost = baseCost + bufferAmount;
  const profitAmount = (bufferedCost * i.profitPercent) / 100;
  const sellingPrice = bufferedCost + profitAmount;
  const taxAmount = i.taxEnabled ? (sellingPrice * i.taxRate) / 100 : 0;
  const unitFinalPrice = sellingPrice + taxAmount;
  return {
    materialCost,
    laborCost,
    electricityCost,
    maintenanceCostPerHour,
    maintenanceCost,
    baseCost,
    bufferAmount,
    bufferedCost,
    profitAmount,
    sellingPrice,
    taxAmount,
    unitFinalPrice,
    totalPrice: unitFinalPrice * i.quantity,
  };
}
