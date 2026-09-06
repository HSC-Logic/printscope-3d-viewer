import { Canvas, useThree } from "@react-three/fiber";
import {
  Bounds,
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
} from "@react-three/drei";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { WebGLRenderer } from "three";
import type { LoadedModel, PrinterProfile, TransformState } from "../../types";
export interface ViewerHandle {
  reset: () => void;
  screenshot: () => string;
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
}
function Capture({
  api,
}: {
  api: React.MutableRefObject<{ gl: WebGLRenderer; reset: () => void } | null>;
}) {
  const { gl, camera } = useThree();
  useEffect(() => {
    api.current = {
      gl,
      reset: () => {
        camera.position.set(180, 160, 180);
        camera.lookAt(0, 0, 40);
      },
    };
    return () => {
      api.current = null;
    };
  }, [gl, camera, api]);
  return null;
}
export const ModelViewer = forwardRef<ViewerHandle, Props>((p, ref) => {
  const api = useRef<{ gl: WebGLRenderer; reset: () => void } | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      reset: () => api.current?.reset(),
      screenshot: () => api.current?.gl.domElement.toDataURL("image/png") ?? "",
    }),
    [],
  );
  return (
    <Canvas
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 2]}
      shadows
      onCreated={({ gl }) =>
        gl.setClearColor(p.orthographic ? "#e7eaf0" : "#10131a")
      }
    >
      <Capture api={api} />
      {p.orthographic ? (
        <OrthographicCamera makeDefault position={[180, 160, 180]} zoom={2} />
      ) : (
        <PerspectiveCamera makeDefault position={[180, 160, 180]} fov={42} />
      )}
      <ambientLight intensity={1.3} />
      <directionalLight position={[120, 180, 100]} intensity={2} castShadow />
      <OrbitControls makeDefault enableDamping />
      <Bounds fit clip observe margin={1.25}>
        {p.model && (
          <group
            position={p.transform.position}
            rotation={p.transform.rotation}
            scale={p.transform.scale}
          >
            {p.model.geometries.map((g, i) => (
              <mesh key={i} geometry={g} castShadow receiveShadow>
                <meshStandardMaterial
                  color={p.color}
                  roughness={0.62}
                  metalness={0.08}
                  wireframe={p.mode === "wireframe"}
                />
                {p.mode === "edges" && <Edges color="#0f172a" threshold={15} />}
              </mesh>
            ))}
          </group>
        )}
      </Bounds>
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
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport />
      </GizmoHelper>
    </Canvas>
  );
});
