import { Box3, BufferGeometry, Matrix4, Vector3 } from "three";
import type { GeometryAnalysis } from "../types";
export function analyzeGeometries(
  geometries: BufferGeometry[],
  matrices: Matrix4[] = [],
): GeometryAnalysis {
  const bounds = new Box3();
  let triangles = 0,
    surface = 0,
    signedVolume = 0,
    degenerate = 0;
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    ab = new Vector3(),
    ac = new Vector3();
  geometries.forEach((g, gi) => {
    const p = g.getAttribute("position");
    if (!p) return;
    const idx = g.index;
    const count = idx ? idx.count : p.count;
    const m = matrices[gi] ?? new Matrix4();
    for (let j = 0; j + 2 < count; j += 3) {
      const ia = idx?.getX(j) ?? j,
        ib = idx?.getX(j + 1) ?? j + 1,
        ic = idx?.getX(j + 2) ?? j + 2;
      a.fromBufferAttribute(p, ia).applyMatrix4(m);
      b.fromBufferAttribute(p, ib).applyMatrix4(m);
      c.fromBufferAttribute(p, ic).applyMatrix4(m);
      if (![a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z].every(Number.isFinite))
        continue;
      bounds.expandByPoint(a);
      bounds.expandByPoint(b);
      bounds.expandByPoint(c);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const twiceArea = ab.cross(ac).length();
      if (twiceArea < 1e-10) {
        degenerate++;
        continue;
      }
      surface += twiceArea / 2;
      signedVolume += a.dot(new Vector3().crossVectors(b, c)) / 6;
      triangles++;
    }
  });
  const size = bounds.isEmpty() ? new Vector3() : bounds.getSize(new Vector3());
  return {
    dimensions: { width: size.x, depth: size.y, height: size.z },
    triangles,
    meshes: geometries.length,
    surfaceAreaCm2: surface / 100,
    volumeCm3: Math.abs(signedVolume) / 1000,
    boundingVolumeCm3: (size.x * size.y * size.z) / 1000,
    volumeReliable:
      triangles > 0 && degenerate === 0 && Math.abs(signedVolume) > 1e-8,
  };
}
