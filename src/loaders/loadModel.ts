import { Mesh, BufferGeometry, type Material } from "three";
import { normalizationFor } from "../geometry/analyzeGeometry";
import { analyzeOffMain } from "../geometry/analyzeOffMain";
import type { LoadedModel } from "../types";
const MAX = 100 * 1024 * 1024;
const MAX_TRIANGLES = 5_000_000;
function disposeMaterials(materials: Array<Material | Material[] | null>) {
  const unique = new Set<Material>();
  materials
    .flatMap((m) => (Array.isArray(m) ? m : m ? [m] : []))
    .forEach((m) => unique.add(m));
  unique.forEach((material) => {
    for (const value of Object.values(material))
      if (
        value &&
        typeof value === "object" &&
        "isTexture" in value &&
        (value as { isTexture?: boolean }).isTexture &&
        "dispose" in value
      )
        (value as { dispose: () => void }).dispose();
    material.dispose();
  });
}
export async function loadModel(
  file: File,
  signal?: AbortSignal,
): Promise<LoadedModel> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "stl" && ext !== "3mf")
    throw new Error("Unsupported file. Choose an STL or 3MF model.");
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX)
    throw new Error("This file exceeds the 100 MB browser limit.");
  let geometries: BufferGeometry[] = [];
  const meshNames: string[] = [];
  const meshMaterials: Array<Material | Material[] | null> = [];
  try {
    const data = await file.arrayBuffer();
    if (signal?.aborted)
      throw new DOMException("Loading cancelled.", "AbortError");
    if (ext === "stl") {
      const { STLLoader } =
        await import("three/examples/jsm/loaders/STLLoader.js");
      const geometry = new STLLoader().parse(data);
      if (!geometry.getAttribute("position")?.count)
        throw new Error("No usable triangles were found.");
      geometries = [geometry];
      meshNames.push(file.name.replace(/\.[^.]+$/, ""));
      meshMaterials.push(null);
    } else {
      const { ThreeMFLoader } =
        await import("three/examples/jsm/loaders/3MFLoader.js");
      const group = new ThreeMFLoader().parse(data);
      group.updateMatrixWorld(true);
      group.traverse((o) => {
        if ((o as Mesh).isMesh) {
          const mesh = o as Mesh;
          if (mesh.geometry.getAttribute("position"))
            geometries.push(
              mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
            );
          if (mesh.geometry.getAttribute("position"))
            meshNames.push(mesh.name || `Mesh ${meshNames.length + 1}`);
          if (mesh.geometry.getAttribute("position"))
            meshMaterials.push(mesh.material);
        }
      });
    }
  } catch (error) {
    geometries.forEach((geometry) => geometry.dispose());
    disposeMaterials(meshMaterials);
    throw new Error(
      `Could not read ${ext.toUpperCase()} model: ${error instanceof Error ? error.message : "invalid data"}`,
    );
  }
  if (!geometries.length) throw new Error("No usable mesh geometry was found.");
  let analysis;
  try {
    analysis = await analyzeOffMain(geometries, [], signal);
  } catch (error) {
    geometries.forEach((g) => g.dispose());
    disposeMaterials(meshMaterials);
    throw error;
  }
  if (analysis.triangles > MAX_TRIANGLES) {
    geometries.forEach((g) => g.dispose());
    disposeMaterials(meshMaterials);
    throw new Error(
      `This model has ${analysis.triangles.toLocaleString()} triangles and exceeds the browser safety limit.`,
    );
  }
  if (analysis.diagnostics.invalidTriangleCount) {
    geometries.forEach((g) => g.dispose());
    disposeMaterials(meshMaterials);
    throw new Error("The model contains non-finite vertex coordinates.");
  }
  if (!analysis.triangles) {
    geometries.forEach((g) => g.dispose());
    disposeMaterials(meshMaterials);
    throw new Error("No usable triangles were found.");
  }
  return {
    name: file.name,
    extension: ext,
    size: file.size,
    geometries,
    analysis,
    normalization: normalizationFor(geometries),
    meshNames,
    hasModelColors:
      geometries.some((g) => Boolean(g.getAttribute("color"))) ||
      meshMaterials.some(Boolean),
    meshMaterials,
  };
}
export function disposeModel(model: LoadedModel | null) {
  model?.geometries.forEach((g) => g.dispose());
  if (model) disposeMaterials(model.meshMaterials);
}
