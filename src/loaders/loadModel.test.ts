import { describe, expect, it } from "vitest";
import { loadModel } from "./loadModel";
import { zipSync, strToU8, unzipSync } from "fflate";
function modelFile(name: string, contents: string | Uint8Array): File {
  const bytes = typeof contents === "string" ? new TextEncoder().encode(contents) : contents;
  return { name, size: bytes.byteLength, arrayBuffer: async () => Uint8Array.from(bytes).buffer } as File;
}
describe("model validation", () => {
  it("rejects unsupported extensions", async () =>
    await expect(loadModel(new File(["x"], "part.fbx"))).rejects.toThrow(
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
  it("loads OBJ polygon geometry", async () => {
    const obj = "o Triangle\nv 0 0 0\nv 10 0 0\nv 0 10 0\nf 1 2 3\n";
    const model = await loadModel(modelFile("triangle.obj", obj));
    expect(model.extension).toBe("obj");
    expect(model.analysis.triangles).toBe(1);
    expect(model.meshNames[0]).toBe("Triangle");
  });
  it("loads ASCII PLY geometry with vertex colours", async () => {
    const ply = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face 1
property list uchar int vertex_indices
end_header
0 0 0 255 0 0
10 0 0 0 255 0
0 10 0 0 0 255
3 0 1 2`;
    const model = await loadModel(modelFile("coloured.ply", ply));
    expect(model.extension).toBe("ply");
    expect(model.analysis.triangles).toBe(1);
    expect(model.geometries[0]?.getAttribute("color")).toBeTruthy();
  });
  it.each(["gltf", "glb"] as const)("loads embedded %s geometry", async (extension) => {
    const positions = new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0]);
    const indices = new Uint16Array([0, 1, 2]);
    const binary = new Uint8Array(44);
    binary.set(new Uint8Array(positions.buffer), 0);
    binary.set(new Uint8Array(indices.buffer), 36);
    const definition = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 44 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [0.01, 0.01, 0] },
        { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
      ],
      meshes: [{ name: "Triangle", primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    };
    let contents: string | Uint8Array;
    if (extension === "gltf") {
      contents = JSON.stringify({ ...definition, buffers: [{ byteLength: 44, uri: `data:application/octet-stream;base64,${btoa(String.fromCharCode(...binary))}` }] });
    } else {
      const json = new TextEncoder().encode(JSON.stringify(definition));
      const jsonLength = Math.ceil(json.length / 4) * 4;
      const total = 12 + 8 + jsonLength + 8 + binary.length;
      const glb = new Uint8Array(total);
      const view = new DataView(glb.buffer);
      view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
      view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true);
      glb.fill(0x20, 20, 20 + jsonLength); glb.set(json, 20);
      const binStart = 20 + jsonLength;
      view.setUint32(binStart, binary.length, true); view.setUint32(binStart + 4, 0x004e4942, true); glb.set(binary, binStart + 8);
      contents = glb;
    }
    const model = await loadModel(modelFile(`triangle.${extension}`, contents));
    expect(model.extension).toBe(extension);
    expect(model.analysis.triangles).toBe(1);
    expect(model.analysis.dimensions.width).toBeCloseTo(10);
    expect(model.meshNames[0]).toBe("Triangle");
  });
});
