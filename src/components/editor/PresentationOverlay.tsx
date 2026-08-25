import { useEffect } from "react";
import { useScene } from "../../store/scene";
import { useUI } from "../../store/ui";
import type { TimeOfDay } from "../../types";
import {
  IconSun,
  IconSunset,
  IconMoon,
  IconMaximize,
  IconShare,
  IconExport,
  IconClose,
  PrebuildMark,
} from "../icons";

const TIMES: { id: TimeOfDay; label: string; icon: React.ReactNode }[] = [
  { id: "day", label: "Day", icon: <IconSun size={12} /> },
  { id: "sunset", label: "Sunset", icon: <IconSunset size={12} /> },
  { id: "night", label: "Night", icon: <IconMoon size={12} /> },
];

export function PresentationOverlay() {
  const projectName = useScene((s) => s.projectName);
  const setPresenting = useUI((s) => s.setPresenting);
  const presentationTime = useUI((s) => s.presentationTime);
  const setPresentationTime = useUI((s) => s.setPresentationTime);
  const openShare = useUI((s) => s.openShare);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPresenting]);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  return (
    <div className="pb-fade pointer-events-none absolute inset-0 z-30 flex flex-col">
      {/* top */}
      <div className="pointer-events-auto flex items-center justify-between p-5">
        <div className="flex items-center gap-2 text-accent">
          <PrebuildMark size={17} />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-text/60">
            PREBUILD
          </span>
          <span className="mx-1 h-3 w-px bg-text/20" />
          <span className="text-[13px] font-medium text-text/90">{projectName}</span>
        </div>
        <button
          onClick={() => setPresenting(false)}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/15 bg-black/25 text-white/70 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white"
          title="Exit presentation (Esc)"
        >
          <IconClose size={14} />
        </button>
      </div>

      <div className="flex-1" />

      {/* bottom controls */}
      <div className="pointer-events-auto flex justify-center pb-5">
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 shadow-pop backdrop-blur-md">
          <div className="flex overflow-hidden rounded-sm border border-white/10">
            {TIMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setPresentationTime(t.id)}
                className={`flex h-7 items-center gap-1.5 px-3 font-mono text-[10.5px] uppercase tracking-wider transition-colors ${
                  presentationTime === t.id
                    ? "bg-accent text-void"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <span className="h-5 w-px bg-white/10" />
          <button
            onClick={fullscreen}
            title="Fullscreen"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconMaximize size={13} />
          </button>
          <button
            onClick={openShare}
            title="Share"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconShare size={13} />
          </button>
          <button
            onClick={() => showToast("High-quality render queued")}
            title="Export"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconExport size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
