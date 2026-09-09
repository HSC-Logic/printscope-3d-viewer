import { Camera, Focus, Maximize } from "lucide-react";
import type { ViewerHandle } from "./ModelViewer";

export type CameraPreset = Parameters<ViewerHandle["view"]>[0];
const presets: CameraPreset[] = ["isometric", "front", "back", "left", "right", "top", "bottom"];

interface Props {
  active: CameraPreset;
  fullscreen: boolean;
  onView: (preset: CameraPreset) => void;
  onFit: () => void;
  onReset: () => void;
  onFullscreen: () => void;
}

export function ViewerToolbar({ active, fullscreen, onView, onFit, onReset, onFullscreen }: Props) {
  return (
    <div className="viewer-toolbar" aria-label="Viewer controls" data-testid="viewer-toolbar">
      <div className="view-presets" role="group" aria-label="Camera view">
        <span className="toolbar-label">View</span>
        <div className="view-buttons">
          {presets.map((preset) => (
            <button key={preset} aria-label={`${preset} camera view`} aria-pressed={active === preset} onClick={() => onView(preset)}>
              {preset.charAt(0).toUpperCase() + preset.slice(1)}
            </button>
          ))}
        </div>
        <select className="view-select" aria-label="Camera view" value={active} onChange={(event) => onView(event.target.value as CameraPreset)}>
          {presets.map((preset) => <option key={preset} value={preset}>{preset.charAt(0).toUpperCase() + preset.slice(1)}</option>)}
        </select>
      </div>
      <div className="viewer-actions" role="group" aria-label="Viewer actions">
        <button className="compact-action" onClick={onFit} aria-label="Fit model in view" title="Fit model in view"><Focus /><span>Fit</span></button>
        <button className="compact-action" onClick={onReset} aria-label="Reset camera" title="Reset camera"><Camera /><span>Reset</span></button>
        <button className="icon-button" onClick={onFullscreen} aria-label={fullscreen ? "Exit viewer fullscreen" : "Enter viewer fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}><Maximize /></button>
      </div>
    </div>
  );
}
