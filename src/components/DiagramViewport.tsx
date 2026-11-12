"use client";

import { useState, type ReactNode } from "react";

export function DiagramViewport({ label, className = "", markup, children }: { label: string; className?: string; markup?: string; children?: ReactNode }) {
  const [zoom, setZoom] = useState(100);
  return <div className={`card diagram-viewport ${className}`}>
    <div className="diagram-toolbar">
      <span className="muted">{label}</span>
      <div className="row" role="group" aria-label={`${label} zoom controls`}>
        <button className="ghost sm" type="button" aria-label={`Zoom out ${label}`} disabled={zoom <= 50} onClick={() => setZoom((z) => Math.max(50, z - 25))}>−</button>
        <output aria-live="polite" aria-label="Zoom level">{zoom}%</output>
        <button className="ghost sm" type="button" aria-label={`Zoom in ${label}`} disabled={zoom >= 300} onClick={() => setZoom((z) => Math.min(300, z + 25))}>+</button>
        <button className="ghost sm" type="button" onClick={() => setZoom(100)}>Fit to width</button>
      </div>
    </div>
    <div className="diagram-scroll" tabIndex={0} role="region" aria-label={`${label}; scroll to explore when zoomed`}>
      {markup !== undefined
        ? <div className="diagram-canvas" style={{ width: `${zoom}%` }} dangerouslySetInnerHTML={{ __html: markup }} />
        : <div className="diagram-canvas" style={{ width: `${zoom}%` }}>{children}</div>}
    </div>
  </div>;
}
