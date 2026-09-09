import { useEffect, useState } from "react";
import type { MaterialProfile, PrinterProfile } from "../../types";
import { Dialog } from "../common/Dialog";

type EditorState = { kind: "printer"; value: PrinterProfile; duplicate: boolean } | { kind: "material"; value: MaterialProfile; duplicate: boolean };

export function ProfileDialog({ state, onClose, onSave }: { state: EditorState; onClose: () => void; onSave: (state: EditorState) => void }) {
  const [draft, setDraft] = useState(state);
  useEffect(() => setDraft(state), [state]);
  const setNumber = (value: string) => Number(value);
  const invalid = draft.kind === "printer"
    ? !draft.value.name.trim() || [draft.value.build.width, draft.value.build.depth, draft.value.build.height, draft.value.powerW, draft.value.purchasePrice].some((value) => !Number.isFinite(value) || value <= 0)
    : !draft.value.name.trim() || !Number.isFinite(draft.value.density) || draft.value.density <= 0 || !Number.isFinite(draft.value.costPerKg) || draft.value.costPerKg < 0 || !/^#[0-9a-f]{6}$/i.test(draft.value.color);
  return (
    <Dialog title={`${draft.duplicate ? "Add" : "Edit"} ${draft.kind} profile`} description="Changes are applied only after every field is valid and you choose Save." onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (!invalid) onSave(draft); }}>
        <label className="field"><span>Name</span><input value={draft.value.name} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, name: event.target.value } } as EditorState)} /></label>
        {draft.kind === "printer" ? <>
          <div className="grid3">
            {(["width", "depth", "height"] as const).map((key) => <label className="field" key={key}><span>Build {key} (mm)</span><input type="number" min="0.01" value={draft.value.build[key]} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, build: { ...draft.value.build, [key]: setNumber(event.target.value) } } })} /></label>)}
          </div>
          <div className="grid2">
            <label className="field"><span>Power (W)</span><input type="number" min="0.01" value={draft.value.powerW} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, powerW: setNumber(event.target.value) } })} /></label>
            <label className="field"><span>Purchase price</span><input type="number" min="0.01" value={draft.value.purchasePrice} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, purchasePrice: setNumber(event.target.value) } })} /></label>
          </div>
        </> : <>
          <div className="grid2">
            <label className="field"><span>Density (g/cm³)</span><input type="number" min="0.001" step="any" value={draft.value.density} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, density: setNumber(event.target.value) } })} /></label>
            <label className="field"><span>Cost per kg</span><input type="number" min="0" step="any" value={draft.value.costPerKg} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, costPerKg: setNumber(event.target.value) } })} /></label>
          </div>
          <label className="field"><span>Colour</span><input type="color" value={draft.value.color} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, color: event.target.value } })} /></label>
          <label className="field"><span>Notes</span><textarea value={draft.value.notes} onChange={(event) => setDraft({ ...draft, value: { ...draft.value, notes: event.target.value } })} /></label>
        </>}
        {invalid && <p className="field-error" role="alert">Complete every field with a valid value.</p>}
        <div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={invalid} onClick={() => onSave(draft)}>Save profile</button></div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }) {
  return <Dialog title="Delete profile?" description={`“${name}” will be removed from this browser. This cannot be undone.`} onClose={onClose}><div className="dialog-actions"><button onClick={onClose}>Cancel</button><button className="danger" onClick={onConfirm}>Delete profile</button></div></Dialog>;
}

export type { EditorState };
