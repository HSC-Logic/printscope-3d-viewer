import { FileUp, LockKeyhole } from "lucide-react";

export function EmptyUploadState({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="empty-state" data-testid="empty-upload-state">
      <div className="empty-icon" aria-hidden="true"><FileUp /></div>
      <div className="empty-copy">
        <h1>Drop your 3D model here</h1>
        <p>Inspect geometry, check printer fit, and prepare a quotation.</p>
      </div>
      <button className="primary" onClick={onSelect}><FileUp /> Choose a model</button>
      <p className="empty-meta">STL · 3MF · OBJ · GLB · glTF · PLY<br />Maximum 100 MB per selection</p>
      <p className="privacy-note"><LockKeyhole /> Processed locally — your model never leaves this browser.</p>
    </div>
  );
}
