import { Canvas, useThree } from "@react-three/fiber";
import {
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
} from "@react-three/drei";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { WebGLRenderer } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  LoadedModel,
  PrinterProfile,
  TransformState,
  WorldBounds,
} from "../../types";
export interface ViewerHandle {
  reset: () => void;
  screenshot: () => string;
  view: (
    preset:
      "isometric" | "front" | "back" | "left" | "right" | "top" | "bottom",
  ) => void;
}
interface Props {
  model: LoadedModel | null;
  printer: PrinterProfile;
  transform: TransformState;
  color: string;
  mode: "solid" | "wireframe" | "edges";
  showGrid: boolean;
  showAxes: boolean;
  showVolume: boolean;
  orthographic: boolean;
  background: string;
  bounds: WorldBounds | null;
  useModelColors: boolean;
}
function Capture({
  api,
  controls,
  onContextState,
  bounds,
}: {
  api: React.MutableRefObject<{
    gl: WebGLRenderer;
    capture: () => string;
    reset: () => void;
    view: ViewerHandle["view"];
  } | null>;
  controls: React.MutableRefObject<OrbitControlsImpl | null>;
  onContextState: (message: string) => void;
  bounds: WorldBounds | null;
}) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onContextState(
        "WebGL context lost. Waiting for the browser to restore it…",
      );
    };
    const restored = () => onContextState("");
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    const view: ViewerHandle["view"] = (preset) => {
      const center = bounds
        ? ([
            (bounds.min[0] + bounds.max[0]) / 2,
            (bounds.min[1] + bounds.max[1]) / 2,
            (bounds.min[2] + bounds.max[2]) / 2,
          ] as const)
        : ([0, 0, 50] as const);
      const extent = bounds
        ? Math.max(
            bounds.max[0] - bounds.min[0],
            bounds.max[1] - bounds.min[1],
            bounds.max[2] - bounds.min[2],
            1,
          )
        : 100;
      const distance = Math.max(extent * 2.2, 20);
      const positions = {
        isometric: [
          center[0] + distance,
          center[1] + distance,
          center[2] + distance,
        ],
        front: [center[0], center[1] - distance, center[2]],
        back: [center[0], center[1] + distance, center[2]],
        left: [center[0] - distance, center[1], center[2]],
        right: [center[0] + distance, center[1], center[2]],
        top: [center[0], center[1], center[2] + distance],
        bottom: [center[0], center[1], center[2] - distance],
      } as const;
      const position = positions[preset];
      camera.position.set(position[0], position[1], position[2]);
      camera.up.set(0, 0, 1);
      if (preset === "top" || preset === "bottom") camera.up.set(0, 1, 0);
      controls.current?.target.set(center[0], center[1], center[2]);
      camera.lookAt(center[0], center[1], center[2]);
      if ("zoom" in camera && typeof camera.zoom === "number")
        camera.zoom = Math.max(0.1, 200 / extent);
      camera.near = Math.max(0.01, distance / 1000);
      camera.far = Math.max(1000, distance * 20);
      camera.updateProjectionMatrix();
      controls.current?.update();
    };
    api.current = {
      gl,
      capture: () => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      },
      reset: () => view("isometric"),
      view,
    };
    return () => {
      api.current = null;
      gl.domElement.removeEventListener("webglcontextlost", lost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, camera, scene, api, controls, onContextState, bounds]);
  return null;
}
export const ModelViewer = forwardRef<ViewerHandle, Props>((p, ref) => {
  const [contextMessage, setContextMessage] = useState("");
  const api = useRef<{
    gl: WebGLRenderer;
    capture: () => string;
    reset: () => void;
    view: ViewerHandle["view"];
  } | null>(null);
  const controls = useRef<OrbitControlsImpl | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      reset: () => api.current?.reset(),
      screenshot: () => api.current?.capture() ?? "",
      view: (preset) => api.current?.view(preset),
    }),
    [],
  );
  return (
    <div className="viewer-canvas">
      <Canvas
        key={p.background}
        gl={{ antialias: true }}
        dpr={[1, 2]}
        shadows
        onCreated={({ gl }) => gl.setClearColor(p.background)}
      >
        <Capture
          api={api}
          controls={controls}
          onContextState={setContextMessage}
          bounds={p.bounds}
        />
        {p.orthographic ? (
          <OrthographicCamera makeDefault position={[180, 160, 180]} zoom={2} />
        ) : (
          <PerspectiveCamera makeDefault position={[180, 160, 180]} fov={42} />
        )}
        <ambientLight intensity={1.3} />
        <directionalLight position={[120, 180, 100]} intensity={2} castShadow />
        <OrbitControls ref={controls} makeDefault enableDamping />
        <group>
          {p.model && (
            <group
              position={p.transform.position}
              rotation={
                p.transform.rotation.map((v) => (v * Math.PI) / 180) as [
                  number,
                  number,
                  number,
                ]
              }
              scale={p.transform.scale}
            >
              <group position={p.model.normalization}>
                {p.model.geometries.map((g, i) => (
                  <mesh
                    key={i}
                    geometry={g}
                    castShadow
                    receiveShadow
                    material={
                      p.useModelColors
                        ? (p.model?.meshMaterials[i] ?? undefined)
                        : undefined
                    }
                  >
                    {!(p.useModelColors && p.model?.meshMaterials[i]) && (
                      <meshStandardMaterial
                        color={p.color}
                        vertexColors={
                          p.useModelColors && Boolean(g.getAttribute("color"))
                        }
                        roughness={0.62}
                        metalness={0.08}
                        wireframe={p.mode === "wireframe"}
                      />
                    )}
                    {p.mode === "edges" && (
                      <Edges color="#0f172a" threshold={15} />
                    )}
                  </mesh>
                ))}
              </group>
            </group>
          )}
        </group>
        {p.showGrid && (
          <Grid
            args={[p.printer.build.width, p.printer.build.depth]}
            position={[0, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            cellSize={10}
            sectionSize={50}
            fadeDistance={500}
          />
        )}{" "}
        {p.showAxes && <axesHelper args={[80]} />}{" "}
        {p.showVolume && (
          <mesh position={[0, 0, p.printer.build.height / 2]}>
            <boxGeometry
              args={[
                p.printer.build.width,
                p.printer.build.depth,
                p.printer.build.height,
              ]}
            />
            <meshBasicMaterial
              color="#fb923c"
              wireframe
              transparent
              opacity={0.28}
            />
          </mesh>
        )}
        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
      {contextMessage && (
        <div className="loading" role="status">
          {contextMessage}
        </div>
      )}
    </div>
  );
});
