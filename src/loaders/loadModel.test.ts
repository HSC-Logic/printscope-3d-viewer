import { describe, expect, it } from "vitest";
import { loadModel } from "./loadModel";
import { zipSync, strToU8, unzipSync } from "fflate";
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
    expect(m.normalization).toEqual([-5, -5, 0]);
    expect(m.meshNames).toEqual(["part"]);
    expect(m.meshMaterials).toEqual([null]);
  });
  it("loads a minimal 3MF package with real zipped model XML", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" name="Tetrahedron" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="10"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
    const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
    const bytes = zipSync({
      "3D/3dmodel.model": strToU8(xml),
      "_rels/.rels": strToU8(rels),
    });
    const file = {
      name: "minimal.3mf",
      size: bytes.byteLength,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    } as File;
    expect(
      Object.keys(unzipSync(new Uint8Array(await file.arrayBuffer()))),
    ).toContain("_rels/.rels");
    const model = await loadModel(file);
    expect(model.extension).toBe("3mf");
    expect(model.analysis.triangles).toBe(4);
    expect(model.meshNames).toHaveLength(1);
  });
});
