import { useEffect, useState } from "react";
import { useScene } from "../../store/scene";
import { useUI } from "../../store/ui";
import { IconClose, IconCopy, IconCheck, PrebuildMark } from "../icons";

function useEsc(onEsc: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEsc();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEsc]);
}

export function ShareModal() {
  const open = useUI((s) => s.shareOpen);
  const close = useUI((s) => s.closeShare);
  const showToast = useUI((s) => s.showToast);
  const projectName = useScene((s) => s.projectName);
  const [copied, setCopied] = useState(false);
  useEsc(close);

  if (!open) return null;
  const link = `https://prebuild.app/s/${projectName.toLowerCase().replace(/\s+/g, "-")}-8f2k`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard unavailable — mock anyway */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="pb-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="pb-rise w-[420px] overflow-hidden rounded-md border border-line bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[14px] font-medium text-text">Share Project</h3>
          <button onClick={close} className="text-faint transition-colors hover:text-text">
            <IconClose size={15} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Access</p>
            <div className="flex items-center justify-between rounded-sm border border-line bg-raised/50 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 font-mono text-[10px] text-accent">
                  ∞
                </span>
                <span className="text-[12.5px] text-text">Anyone with the link</span>
              </div>
              <select
                defaultValue="viewer"
                className="rounded-xs border border-line bg-base px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider text-dim outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="commenter">Commenter</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Presentation link
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="h-8 min-w-0 flex-1 rounded-sm border border-line bg-raised/60 px-2.5 font-mono text-[11.5px] text-dim outline-none focus:border-accent-dim"
              />
              <button
                onClick={copy}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-3 font-mono text-[10.5px] uppercase tracking-wider transition-all ${
                  copied
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-line-strong/60 text-dim hover:bg-hover hover:text-text"
                }`}
              >
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-line px-4 py-2.5">
          <p className="font-mono text-[9.5px] leading-relaxed tracking-wide text-faint/70">
            CLIENTS WILL SEE THE PRESENTATION VIEW · DAY / SUNSET / NIGHT CONTROLS INCLUDED
          </p>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pb-rise pointer-events-none fixed left-1/2 top-16 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-sm border border-line bg-surface px-3.5 py-2 shadow-pop">
        <PrebuildMark size={13} />
        <span className="text-[12.5px] text-text">{toast.message}</span>
      </div>
    </div>
  );
}
