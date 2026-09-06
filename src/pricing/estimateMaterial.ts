export interface EstimateInputs {
  volumeCm3: number;
  density: number;
  infillPercent: number;
  shellFactor: number;
  supportPercent: number;
  wastePercent: number;
  flowRateGPerHour: number;
}
export function quickEstimate(i: EstimateInputs) {
  for (const v of Object.values(i))
    if (!Number.isFinite(v) || v < 0)
      throw new Error("Estimate values must be finite and non-negative");
  const solidMass = i.volumeCm3 * i.density;
  const filamentGrams =
    solidMass *
    (i.infillPercent / 100) *
    i.shellFactor *
    (1 + i.supportPercent / 100) *
    (1 + i.wastePercent / 100);
  return {
    filamentGrams,
    printHours: i.flowRateGPerHour > 0 ? filamentGrams / i.flowRateGPerHour : 0,
  };
}
