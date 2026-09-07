import {
  Box3,
  BufferGeometry,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type { GeometryAnalysis, TransformState, WorldBounds } from "../types";
const EPS = 1e-8;
const vertexKey = (v: Vector3) =>
  `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`;
const edgeKey = (a: Vector3, b: Vector3) => {
  const x = vertexKey(a),
    y = vertexKey(b);
  return x < y ? `${x}|${y}` : `${y}|${x}`;
};
export function normalizationFor(
  gs: BufferGeometry[],
): [number, number, number] {
  const box = new Box3();
  gs.forEach((g) => {
    g.computeBoundingBox();
    if (g.boundingBox) box.union(g.boundingBox);
  });
  if (box.isEmpty()) return [0, 0, 0];
  const c = box.getCenter(new Vector3());
  return [
    c.x === 0 ? 0 : -c.x,
    c.y === 0 ? 0 : -c.y,
    box.min.z === 0 ? 0 : -box.min.z,
  ];
}
export function modelMatrix(
  n: [number, number, number],
  t: TransformState,
): Matrix4 {
  const degrees = t.rotation.map((v) => (v * Math.PI) / 180) as [
    number,
    number,
    number,
  ];
  const user = new Matrix4().compose(
    new Vector3(...t.position),
    new Quaternion().setFromEuler(new Euler(...degrees, "XYZ")),
    new Vector3(...t.scale),
  );
  return user.multiply(new Matrix4().makeTranslation(...n));
}
export function analyzeGeometries(
  gs: BufferGeometry[],
  matrices: Matrix4[] = [],
): GeometryAnalysis {
  const topologyEnabled =
    gs.reduce(
      (sum, g) =>
        sum + (g.index?.count ?? g.getAttribute("position")?.count ?? 0) / 3,
      0,
    ) <= 1_000_000;
  const box = new Box3(),
    edges = new Map<string, number>(),
    edgeBalance = new Map<string, number>();
  let triangles = 0,
    surface = 0,
    volume = 0,
    degenerate = 0,
    invalid = 0;
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    ab = new Vector3(),
    ac = new Vector3(),
    cross = new Vector3();
  gs.forEach((g, gi) => {
    const p = g.getAttribute("position");
    if (!p) return;
    const index = g.index,
      count = index ? index.count : p.count,
      m = matrices[gi] ?? new Matrix4();
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(p, index?.getX(i) ?? i).applyMatrix4(m);
      b.fromBufferAttribute(p, index?.getX(i + 1) ?? i + 1).applyMatrix4(m);
      c.fromBufferAttribute(p, index?.getX(i + 2) ?? i + 2).applyMatrix4(m);
      if (
        ![a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z].every(Number.isFinite)
      ) {
        invalid++;
        continue;
      }
      box.expandByPoint(a);
      box.expandByPoint(b);
      box.expandByPoint(c);
      cross.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      const area2 = cross.length();
      if (area2 < EPS) {
        degenerate++;
        continue;
      }
      surface += area2 / 2;
      volume += a.dot(cross.crossVectors(b, c)) / 6;
      triangles++;
      if (topologyEnabled)
        [
          [a, b],
          [b, c],
          [c, a],
        ].forEach(([from, to]) => {
          const k = edgeKey(from!, to!);
          edges.set(k, (edges.get(k) ?? 0) + 1);
          edgeBalance.set(
            k,
            (edgeBalance.get(k) ?? 0) +
              (vertexKey(from!) < vertexKey(to!) ? 1 : -1),
          );
        });
    }
  });
  const size = box.isEmpty() ? new Vector3() : box.getSize(new Vector3());
  const boundaryEdgeCount = [...edges.values()].filter((n) => n === 1).length,
    nonManifoldEdgeCount = [...edges.values()].filter((n) => n > 2).length,
    inconsistentEdgeCount = [...edges].filter(
      ([key, count]) => count === 2 && edgeBalance.get(key) !== 0,
    ).length,
    warnings: string[] = [];
  if (boundaryEdgeCount)
    warnings.push(`${boundaryEdgeCount} boundary edges indicate an open mesh.`);
  if (nonManifoldEdgeCount)
    warnings.push(`${nonManifoldEdgeCount} non-manifold edges were found.`);
  if (inconsistentEdgeCount)
    warnings.push(
      `${inconsistentEdgeCount} shared edges have inconsistent face orientation.`,
    );
  if (!topologyEnabled)
    warnings.push(
      "Topology checks were skipped above one million triangles to limit browser memory use.",
    );
  if (degenerate)
    warnings.push(`${degenerate} degenerate triangles were ignored.`);
  if (invalid)
    warnings.push(`${invalid} triangles contain invalid coordinates.`);
  const bounds: WorldBounds = box.isEmpty()
    ? { min: [0, 0, 0], max: [0, 0, 0] }
    : {
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
      };
  return {
    dimensions: { width: size.x, depth: size.y, height: size.z },
    triangles,
    meshes: gs.length,
    surfaceAreaCm2: surface / 100,
    volumeCm3: Math.abs(volume) / 1000,
    boundingVolumeCm3: (size.x * size.y * size.z) / 1000,
    bounds,
    diagnostics: {
      volumeReliable:
        triangles > 0 &&
        topologyEnabled &&
        !boundaryEdgeCount &&
        !nonManifoldEdgeCount &&
        !inconsistentEdgeCount &&
        !degenerate &&
        !invalid &&
        Math.abs(volume) > EPS,
      boundaryEdgeCount,
      nonManifoldEdgeCount,
      degenerateTriangleCount: degenerate,
      invalidTriangleCount: invalid,
      warnings,
    },
  };
}
