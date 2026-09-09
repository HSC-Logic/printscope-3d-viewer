import type { BufferGeometry, Material } from "three";
export type Currency = "LKR" | "USD" | "EUR" | "GBP" | "AUD";
export interface Dimensions {
  width: number;
  depth: number;
  height: number;
}
export interface PrinterProfile {
  id: string;
  name: string;
  build: Dimensions;
  powerW: number;
  purchasePrice: number;
  custom?: boolean;
}
export interface MaterialProfile {
  id: string;
  name: string;
  density: number;
  costPerKg: number;
  color: string;
  notes: string;
  custom?: boolean;
}
export interface TransformState {
  position: [number, number, number];
  /** Euler rotation in degrees; converted only at the Three.js boundary. */
  rotation: [number, number, number];
  scale: [number, number, number];
}
export interface WorldBounds {
  min: [number, number, number];
  max: [number, number, number];
}
export interface MeshDiagnostics {
  volumeReliable: boolean;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  degenerateTriangleCount: number;
  invalidTriangleCount: number;
  warnings: string[];
}
export interface GeometryAnalysis {
  dimensions: Dimensions;
  triangles: number;
  meshes: number;
  surfaceAreaCm2: number;
  volumeCm3: number;
  boundingVolumeCm3: number;
  bounds: WorldBounds;
  diagnostics: MeshDiagnostics;
}
export interface LoadedModel {
  name: string;
  extension: "stl" | "3mf" | "obj" | "glb" | "gltf" | "ply";
  size: number;
  geometries: BufferGeometry[];
  analysis: GeometryAnalysis;
  normalization: [number, number, number];
  meshNames: string[];
  hasModelColors: boolean;
  meshMaterials: Array<Material | Material[] | null>;
}
