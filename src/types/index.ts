import type { BufferGeometry } from "three";
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
  rotation: [number, number, number];
  scale: [number, number, number];
}
export interface GeometryAnalysis {
  dimensions: Dimensions;
  triangles: number;
  meshes: number;
  surfaceAreaCm2: number;
  volumeCm3: number;
  boundingVolumeCm3: number;
  volumeReliable: boolean;
}
export interface LoadedModel {
  name: string;
  extension: "stl" | "3mf";
  size: number;
  geometries: BufferGeometry[];
  analysis: GeometryAnalysis;
}
