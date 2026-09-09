import {
  Mesh,
  BufferGeometry,
  LoadingManager,
  type Material,
  type Object3D,
} from "three";
import { normalizationFor } from "../geometry/analyzeGeometry";
import { analyzeOffMain } from "../geometry/analyzeOffMain";
import type { LoadedModel } from "../types";
const MAX = 100 * 1024 * 1024;
const MAX_TRIANGLES = 5_000_000;
export const MODEL_EXTENSIONS = ["stl", "3mf", "obj", "glb", "gltf", "ply"] as const;
export const MODEL_ACCEPT = `${MODEL_EXTENSIONS.map((extension) => `.${extension}`).join(",")},.bin,.png,.jpg,.jpeg,.webp`;
type ModelExtension = (typeof MODEL_EXTENSIONS)[number];
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
  companionFiles: File[] = [],
): Promise<LoadedModel> {
  const candidateExtension = file.name.split(".").pop()?.toLowerCase();
  if (!MODEL_EXTENSIONS.includes(candidateExtension as ModelExtension))
    throw new Error("Unsupported file. Choose an STL, 3MF, OBJ, GLB, glTF, or PLY model.");
  const ext = candidateExtension as ModelExtension;
  if (file.size === 0) throw new Error("This file is empty.");
  const selectionSize = file.size + companionFiles.reduce((total, companion) => total + companion.size, 0);
  if (selectionSize > MAX)
    throw new Error("This model and its companion files exceed the 100 MB browser limit.");
  let geometries: BufferGeometry[] = [];
  const meshNames: string[] = [];
  const meshMaterials: Array<Material | Material[] | null> = [];
  const objectUrls: string[] = [];
  const addScene = (root: Object3D, unitScale = 1) => {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!(object as Mesh).isMesh) return;
      const mesh = object as Mesh;
      if (!mesh.geometry.getAttribute("position")) return;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (unitScale !== 1) geometry.scale(unitScale, unitScale, unitScale);
      geometries.push(geometry);
      meshNames.push(mesh.name || `Mesh ${meshNames.length + 1}`);
      meshMaterials.push(mesh.material);
    });
  };
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
    } else if (ext === "3mf") {
      const { ThreeMFLoader } =
        await import("three/examples/jsm/loaders/3MFLoader.js");
      const group = new ThreeMFLoader().parse(data);
      addScene(group);
    } else if (ext === "obj") {
      const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
      addScene(new OBJLoader().parse(new TextDecoder().decode(data)));
    } else if (ext === "ply") {
      const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
      const geometry = new PLYLoader().parse(data);
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      geometries = [geometry];
      meshNames.push(file.name.replace(/\.[^.]+$/, ""));
      meshMaterials.push(null);
    } else {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const manager = new LoadingManager();
      const resources = new Map(companionFiles.map((resource) => [resource.name, resource]));
      manager.setURLModifier((url) => {
        const clean = decodeURIComponent(url.split(/[?#]/)[0] ?? url);
        const resource = resources.get(clean) ?? resources.get(clean.split("/").pop() ?? "");
        if (!resource) return url;
        const objectUrl = URL.createObjectURL(resource);
        objectUrls.push(objectUrl);
        return objectUrl;
      });
      const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
      const source = ext === "gltf" ? new TextDecoder().decode(data) : data;
      const gltf = await loader.parseAsync(source, "");
      if (signal?.aborted) throw new DOMException("Loading cancelled.", "AbortError");
      // glTF's linear unit is metres; PrintScope's analysis and printer data use mm.
      addScene(gltf.scene, 1000);
    }
  } catch (error) {
    geometries.forEach((geometry) => geometry.dispose());
    disposeMaterials(meshMaterials);
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(
      `Could not read ${ext.toUpperCase()} model: ${error instanceof Error ? error.message : "invalid data"}`,
    );
  } finally {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
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
