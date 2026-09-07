import { BoxGeometry, Matrix4 } from "three";
import { describe, expect, it } from "vitest";
import {
  analyzeGeometries,
  modelMatrix,
  normalizationFor,
} from "./analyzeGeometry";
import type { TransformState } from "../types";
import { checkPrinterFit } from "./printerFit";
import { calculateScaleToFit } from "./scaleToFit";
import { printers } from "../profiles/defaults";
describe("geometry analysis", () => {
  it("calculates indexed cube bounds, surface, and volume", () => {
    const r = analyzeGeometries([new BoxGeometry(10, 20, 30)]);
    expect(r.dimensions).toEqual({ width: 10, depth: 20, height: 30 });
    expect(r.surfaceAreaCm2).toBeCloseTo(22);
    expect(r.volumeCm3).toBeCloseTo(6);
    expect(r.triangles).toBe(12);
  });
  it("accounts for transforms and multiple non-indexed meshes", () => {
    const a = new BoxGeometry(10, 10, 10).toNonIndexed(),
      b = new BoxGeometry(10, 10, 10).toNonIndexed();
    const r = analyzeGeometries(
      [a, b],
      [
        new Matrix4().makeScale(2, 2, 2),
        new Matrix4().makeTranslation(30, 0, 0),
      ],
    );
    expect(r.meshes).toBe(2);
    expect(r.triangles).toBe(24);
    expect(r.volumeCm3).toBeCloseTo(9);
  });
  it("ignores degenerate triangles", () => {
    const r = analyzeGeometries([new BoxGeometry(0, 0, 0)]);
    expect(r.triangles).toBe(0);
    expect(r.diagnostics.volumeReliable).toBe(false);
  });
});
describe("normalization and transformed analysis", () => {
  it("centres positive offset coordinates and places minimum Z on zero", () => {
    const g = new BoxGeometry(10, 20, 30).translate(100, 200, 40);
    const n = normalizationFor([g]);
    expect(n).toEqual([-100, -200, -25]);
    const t: TransformState = {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    const r = analyzeGeometries([g], [modelMatrix(n, t)]);
    expect(r.bounds.min).toEqual([-5, -10, 0]);
    expect(r.bounds.max).toEqual([5, 10, 30]);
  });
  it("normalizes negative-only and multiple mesh bounds together", () => {
    const a = new BoxGeometry(10, 10, 10).translate(-100, -50, -20),
      b = new BoxGeometry(10, 10, 10).translate(-60, -30, 5);
    const n = normalizationFor([a, b]);
    const r = analyzeGeometries(
      [a, b],
      [
        modelMatrix(n, {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        }),
        modelMatrix(n, {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        }),
      ],
    );
    expect(r.bounds.min[2]).toBe(0);
    expect((r.bounds.min[0] + r.bounds.max[0]) / 2).toBeCloseTo(0);
    expect((r.bounds.min[1] + r.bounds.max[1]) / 2).toBeCloseTo(0);
  });
  it("handles non-uniform scaling, rotation and translation", () => {
    const g = new BoxGeometry(10, 20, 30);
    const t: TransformState = {
      position: [15, 5, 2],
      rotation: [0, 0, 90],
      scale: [2, 3, 4],
    };
    const r = analyzeGeometries([g], [modelMatrix(normalizationFor([g]), t)]);
    expect(r.dimensions.width).toBeCloseTo(60);
    expect(r.dimensions.depth).toBeCloseTo(20);
    expect(r.dimensions.height).toBeCloseTo(120);
    expect(r.volumeCm3).toBeCloseTo(144);
    expect(r.surfaceAreaCm2).toBeCloseTo(216);
    expect(r.bounds.min[2]).toBeCloseTo(2);
  });
});
describe("printer fit", () => {
  const p = printers[0]!;
  it("fits exact boundary", () =>
    expect(
      checkPrinterFit({ min: [-110, -110, 0], max: [110, 110, 270] }, p).fits,
    ).toBe(true));
  it.each([
    ["width", 221, 220, 270],
    ["depth", 220, 221, 270],
    ["height", 220, 220, 271],
  ] as const)("reports %s overflow", (axis, width, depth, height) => {
    const bounds: {
      min: [number, number, number];
      max: [number, number, number];
    } = {
      min: [-width / 2, -depth / 2, 0],
      max: [width / 2, depth / 2, height],
    };
    const r = checkPrinterFit(bounds, p);
    expect(r.fits).toBe(false);
    const expected =
      axis === "width" ? "left" : axis === "depth" ? "front" : "above";
    expect(r.violations.map((v) => v.side)).toContain(expected);
  });
  it("reflects scaling", () =>
    expect(
      checkPrinterFit({ min: [-110, -110, 0], max: [110, 110, 270] }, p).fits,
    ).toBe(true));
  it("does not report fit without a model", () =>
    expect(checkPrinterFit(null, p)).toEqual({ fits: false, violations: [] }));
  it.each([
    ["left", { min: [-111, -10, 0], max: [10, 10, 10] }],
    ["right", { min: [-10, -10, 0], max: [111, 10, 10] }],
    ["front", { min: [-10, -111, 0], max: [10, 10, 10] }],
    ["back", { min: [-10, -10, 0], max: [10, 111, 10] }],
    ["below", { min: [-10, -10, -1], max: [10, 10, 10] }],
    ["above", { min: [-10, -10, 0], max: [10, 10, 271] }],
  ] as Array<
    [
      "left" | "right" | "front" | "back" | "below" | "above",
      { min: [number, number, number]; max: [number, number, number] },
    ]
  >)("reports %s boundary violation", (side, bounds) =>
    expect(checkPrinterFit(bounds, p).violations[0]?.side).toBe(side),
  );
});
describe("scale to fit", () => {
  it("ignores planar zero dimensions without infinity", () =>
    expect(
      calculateScaleToFit(
        { width: 100, depth: 50, height: 0 },
        { width: 200, depth: 200, height: 200 },
      ),
    ).toBeCloseTo(1.96));
  it("returns a finite fallback for a point model", () =>
    expect(
      calculateScaleToFit(
        { width: 0, depth: 0, height: 0 },
        { width: 200, depth: 200, height: 200 },
      ),
    ).toBe(0.98));
});
