import type { Dimensions } from "../types";
export function calculateScaleToFit(
  model: Dimensions,
  build: Dimensions,
  padding = 0.98,
) {
  if (!Number.isFinite(padding) || padding <= 0 || padding > 1)
    throw new Error("Padding must be greater than zero and at most one.");
  const pairs: Array<[number, number]> = [
    [build.width, model.width],
    [build.depth, model.depth],
    [build.height, model.height],
  ];
  const limits = pairs
    .filter(
      ([available, size]) =>
        Number.isFinite(available) &&
        available > 0 &&
        Number.isFinite(size) &&
        size > 1e-9,
    )
    .map(([available, size]) => available / size);
  const scale = (limits.length ? Math.min(...limits) : 1) * padding;
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error("A valid fit scale could not be calculated.");
  return scale;
}
