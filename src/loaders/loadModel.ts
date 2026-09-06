import { Mesh, BufferGeometry } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { analyzeGeometries } from "../geometry/analyzeGeometry";
import type { LoadedModel } from "../types";
const MAX = 100 * 1024 * 1024;
export async function loadModel(file: File): Promise<LoadedModel> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "stl" && ext !== "3mf")
    throw new Error("Unsupported file. Choose an STL or 3MF model.");
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX)
    throw new Error("This file exceeds the 100 MB browser limit.");
  let geometries: BufferGeometry[] = [];
  try {
    const data = await file.arrayBuffer();
    if (ext === "stl") {
      const geometry = new STLLoader().parse(data);
      if (!geometry.getAttribute("position")?.count)
        throw new Error("No usable triangles were found.");
      geometries = [geometry];
    } else {
      const group = new ThreeMFLoader().parse(data);
      group.updateMatrixWorld(true);
      group.traverse((o) => {
        if ((o as Mesh).isMesh) {
          const mesh = o as Mesh;
          if (mesh.geometry.getAttribute("position"))
            geometries.push(
              mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
            );
        }
      });
    }
  } catch (error) {
    throw new Error(
      `Could not read ${ext.toUpperCase()} model: ${error instanceof Error ? error.message : "invalid data"}`,
    );
  }
  if (!geometries.length) throw new Error("No usable mesh geometry was found.");
  const analysis = analyzeGeometries(geometries);
  if (!analysis.triangles) {
    geometries.forEach((g) => g.dispose());
    throw new Error("No usable triangles were found.");
  }
  return {
    name: file.name,
    extension: ext,
    size: file.size,
    geometries,
    analysis,
  };
}
export function disposeModel(model: LoadedModel | null) {
  model?.geometries.forEach((g) => g.dispose());
}
