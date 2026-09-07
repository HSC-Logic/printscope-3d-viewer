/// <reference lib="webworker" />
import { BufferAttribute, BufferGeometry, Matrix4 } from "three";
import { analyzeGeometries } from "../geometry/analyzeGeometry";
interface MeshPayload {
  positions: ArrayBuffer;
  indices: ArrayBuffer | null;
}
self.onmessage = (
  event: MessageEvent<{ meshes: MeshPayload[]; matrices: number[][] }>,
) => {
  try {
    const geometries = event.data.meshes.map((mesh) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(mesh.positions), 3),
      );
      if (mesh.indices)
        geometry.setIndex(
          new BufferAttribute(new Uint32Array(mesh.indices), 1),
        );
      return geometry;
    });
    const analysis = analyzeGeometries(
      geometries,
      event.data.matrices.map((values) => new Matrix4().fromArray(values)),
    );
    geometries.forEach((g) => g.dispose());
    self.postMessage({ ok: true, analysis });
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error ? error.message : "Geometry analysis failed.",
    });
  }
};
