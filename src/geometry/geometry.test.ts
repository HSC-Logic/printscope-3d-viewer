import { BoxGeometry, Matrix4 } from "three";
import { describe, expect, it } from "vitest";
import { analyzeGeometries } from "./analyzeGeometry";
import { checkPrinterFit } from "./printerFit";
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
    expect(r.volumeReliable).toBe(false);
  });
});
describe("printer fit", () => {
  const p = printers[0]!;
  it("fits exact boundary", () =>
    expect(checkPrinterFit(p.build, p).fits).toBe(true));
  it.each([
    ["width", 221, 220, 270],
    ["depth", 220, 221, 270],
    ["height", 220, 220, 271],
  ] as const)("reports %s overflow", (axis, width, depth, height) => {
    const r = checkPrinterFit({ width, depth, height }, p);
    expect(r.fits).toBe(false);
    expect(r.overflow).toContain(axis);
  });
  it("reflects scaling", () =>
    expect(
      checkPrinterFit({ width: 110 * 2, depth: 110 * 2, height: 135 * 2 }, p)
        .fits,
    ).toBe(true));
});
