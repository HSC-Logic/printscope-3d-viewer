import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export function OverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div className="overflow-menu" ref={root}>
      <button className="icon-button more-trigger" aria-label="More actions" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}><MoreVertical /></button>
      {open && <div className="overflow-popover" role="menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}
