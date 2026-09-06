import { describe, expect, it } from "vitest";
import { loadModel } from "./loadModel";
describe("model validation", () => {
  it("rejects unsupported extensions", async () =>
    await expect(loadModel(new File(["x"], "part.obj"))).rejects.toThrow(
      "Unsupported",
    ));
  it("rejects empty files", async () =>
    await expect(loadModel(new File([], "part.stl"))).rejects.toThrow("empty"));
  it("loads ASCII STL", async () => {
    const stl = `solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid t`;
    const bytes = new TextEncoder().encode(stl);
    const file = {
      name: "part.stl",
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer,
    } as File;
    const m = await loadModel(file);
    expect(m.analysis.triangles).toBe(1);
    expect(m.extension).toBe("stl");
  });
});
