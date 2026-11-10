"use client";
import { useState } from "react";

export function CopyButton({ text, filename }: { text: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="row">
      <button type="button" className="ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }}>
        {copied ? "Copied" : "Copy notice"}
      </button>
      <a className="btn" download={filename} href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>Download .txt</a>
    </div>
  );
}
