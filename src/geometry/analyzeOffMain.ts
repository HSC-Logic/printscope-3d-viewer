import { Matrix4, type BufferGeometry } from "three";
import type { GeometryAnalysis } from "../types";
import { analyzeGeometries } from "./analyzeGeometry";
const WORKER_THRESHOLD = 50_000;
export async function analyzeOffMain(
  geometries: BufferGeometry[],
  matrices: Matrix4[] = [],
  signal?: AbortSignal,
): Promise<GeometryAnalysis> {
  const vertices = geometries.reduce(
    (sum, g) => sum + (g.getAttribute("position")?.count ?? 0),
    0,
  );
  if (vertices < WORKER_THRESHOLD || typeof Worker === "undefined")
    return analyzeGeometries(geometries, matrices);
  const meshes = geometries.map((g) => {
    const p = g.getAttribute("position"),
      positions = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      positions[i * 3] = p.getX(i);
      positions[i * 3 + 1] = p.getY(i);
      positions[i * 3 + 2] = p.getZ(i);
    }
    const index = g.index,
      indices = index
        ? Uint32Array.from({ length: index.count }, (_, i) => index.getX(i))
        : null;
    return { positions: positions.buffer, indices: indices?.buffer ?? null };
  });
  const transfer = meshes.flatMap((m) =>
    m.indices ? [m.positions, m.indices] : [m.positions],
  );
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/geometryAnalysis.worker.ts", import.meta.url),
      { type: "module" },
    );
    const abort = () => {
      worker.terminate();
      reject(new DOMException("Analysis cancelled.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{
        ok: boolean;
        analysis?: GeometryAnalysis;
        error?: string;
      }>,
    ) => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (event.data.ok && event.data.analysis) resolve(event.data.analysis);
      else reject(new Error(event.data.error ?? "Geometry analysis failed."));
    };
    worker.onerror = () => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      try {
        resolve(analyzeGeometries(geometries, matrices));
      } catch (error) {
        reject(error);
      }
    };
    worker.postMessage(
      {
        meshes,
        matrices: geometries.map((_, i) =>
          (matrices[i] ?? new Matrix4()).toArray(),
        ),
      },
      transfer,
    );
  });
}
