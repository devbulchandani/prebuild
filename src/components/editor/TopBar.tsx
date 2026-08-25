import { useEffect, useRef, useState } from "react";
import { useScene } from "../../store/scene";
import { useUI, type TransformMode } from "../../store/ui";
import {
  IconUndo,
  IconRedo,
  IconPlay,
  IconShare,
  IconExport,
  IconImage,
  IconCube,
  IconPresentation,
  IconSettings,
  PrebuildMark,
} from "../icons";
import { openSettings } from "./SettingsModal";
import { AddMenu } from "./AddMenu";
import {
  exportPNG,
  exportPresentationHTML,
  exportGLB,
} from "../../lib/exporters";

function IconPlan({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 12h9M12 3v18M12 8h9M16 12v9" />
    </svg>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-line" />;
}

function TopButton({
  onClick,
  disabled,
  active,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2 text-dim transition-colors duration-150 hover:bg-hover hover:text-text ${active ? "bg-raised text-text" : ""} disabled:pointer-events-none disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

export function TopBar() {
  const projectName = useScene((s) => s.projectName);
  const setProjectName = useScene((s) => s.setProjectName);
  const saveStatus = useScene((s) => s.saveStatus);
  const undo = useScene((s) => s.undo);
  const redo = useScene((s) => s.redo);
  const canUndo = useScene((s) => s.past.length > 0);
  const canRedo = useScene((s) => s.future.length > 0);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);

  const commitName = () => {
    setEditingName(false);
    if (nameDraft.trim() && nameDraft !== projectName) setProjectName(nameDraft);
    else setNameDraft(projectName);
  };

  const setPresenting = useUI((s) => s.setPresenting);
  const openShare = useUI((s) => s.openShare);
  const openPlan = useUI((s) => s.openPlan);
  const exportOpen = useUI((s) => s.exportOpen);
  const toggleExport = useUI((s) => s.toggleExport);
  const showToast = useUI((s) => s.showToast);
  const setView = useUI((s) => s.setView);

  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) toggleExport(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [exportOpen, toggleExport]);

  const saveLabel =
    saveStatus === "saved" ? "All changes saved" : saveStatus === "saving" ? "Saving…" : "Unsaved changes";

  const runExport = async (kind: "image" | "hq" | "deck" | "model", label: string) => {
    toggleExport(false);
    showToast(`${label} — rendering…`);
    try {
      if (kind === "image") await exportPNG(1);
      else if (kind === "hq") await exportPNG(2.5, "-highres");
      else if (kind === "deck") await exportPresentationHTML();
      else await exportGLB();
      showToast(`${label} downloaded`);
    } catch (err) {
      showToast(`${label} failed${err instanceof Error ? ` — ${err.message}` : ""}`);
    }
  };

  const exports = [
    { icon: <IconImage size={14} />, label: "Image", meta: "PNG · current view", kind: "image" as const },
    { icon: <IconSpark />, label: "High-quality render", meta: "PNG · 2.5× resolution", kind: "hq" as const },
    { icon: <IconPresentation size={14} />, label: "Presentation", meta: "Standalone HTML deck", kind: "deck" as const },
    { icon: <IconCube size={14} />, label: "3D model", meta: "GLB · geometry & materials", kind: "model" as const },
  ];

  return (
    <header className="pointer-events-auto relative z-30 flex shrink-0 items-start justify-between gap-3 px-3 pt-3">
      {/* Brand + project card */}
      <div className="flex h-11 items-center gap-3 rounded-md border border-line bg-base/95 px-3.5 shadow-soft backdrop-blur-md">
        <button
          onClick={() => setView("dashboard")}
          className="flex items-center gap-2 text-accent transition-opacity hover:opacity-75"
          title="Back to projects"
        >
          <PrebuildMark size={18} />
          <span className="hidden text-[12px] font-semibold tracking-[0.2em] text-text xl:inline">
            PREBUILD
          </span>
        </button>
        <div className="h-5 w-px bg-line" />
        <div className="flex min-w-0 items-baseline gap-2">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setNameDraft(projectName);
                  setEditingName(false);
                }
              }}
              spellCheck={false}
              className="w-44 rounded-xs border border-accent-dim bg-raised/70 px-1.5 py-0.5 text-[13px] font-medium text-text outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setNameDraft(projectName);
                setEditingName(true);
              }}
              title="Rename project"
              className="max-w-52 truncate rounded-xs border border-transparent px-1 py-0.5 text-[13px] font-medium text-text transition-colors hover:border-line hover:bg-hover"
            >
              {projectName}
            </button>
          )}
          <span className="hidden items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider lg:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                saveStatus === "saved" ? "bg-accent" : "bg-faint"
              }`}
            />
            <span className="text-faint">{saveLabel}</span>
          </span>
        </div>
      </div>

      {/* Center tools pill */}
      <div className="absolute left-1/2 top-3 flex h-11 -translate-x-1/2 items-center gap-0.5 rounded-md border border-line bg-base/95 px-1.5 shadow-soft backdrop-blur-md">
        <TopButton title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
          <IconUndo />
        </TopButton>
        <TopButton title="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
          <IconRedo />
        </TopButton>
        <Divider />
        <AddMenu />
        <Divider />
        <button
          onClick={openPlan}
          title="Create 3D from a 2D floor plan"
          className="flex h-8 items-center gap-1.5 rounded-sm px-2.5 font-mono text-[10px] uppercase tracking-wider text-dim transition-colors hover:bg-hover hover:text-text"
        >
          <IconPlan size={13} />
          Import Plan
        </button>
        <Divider />
        <button
          onClick={() => setPresenting(true)}
          className="flex h-8 items-center gap-1.5 rounded-sm px-2.5 font-mono text-[10px] uppercase tracking-wider text-dim transition-colors duration-150 hover:bg-hover hover:text-text"
          title="Presentation mode"
        >
          <IconPlay size={13} />
          Preview
        </button>
        <Divider />
        <TopButton title="AI engines & connections" onClick={openSettings}>
          <IconSettings />
        </TopButton>
      </div>

      {/* Right actions */}
      <div className="flex h-11 items-center gap-1.5 rounded-md border border-line bg-base/95 px-1.5 shadow-soft backdrop-blur-md">
        <TopButton title="Share with client" onClick={openShare}>
          <IconShare />
        </TopButton>

        {/* Export menu */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => toggleExport()}
            className={`flex h-8 items-center gap-1.5 rounded-sm bg-text px-3 font-mono text-[10.5px] font-medium uppercase tracking-wider text-base transition-opacity hover:opacity-85 ${
              exportOpen ? "opacity-85" : ""
            }`}
          >
            <IconExport size={13} />
            Export
          </button>
          {exportOpen && (
            <div className="pb-rise absolute right-0 top-10 w-64 rounded-md border border-line bg-surface shadow-pop">
              <div className="border-b border-line px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.15em] text-faint">
                Export project
              </div>
              {exports.map((x) => (
                <button
                  key={x.label}
                  onClick={() => runExport(x.kind, x.label)}
                  className="group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors first:mt-1 hover:bg-hover"
                >
                  <span className="text-dim group-hover:text-accent">{x.icon}</span>
                  <span className="flex-1">
                    <span className="block text-[12.5px] text-text">{x.label}</span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-wide text-faint">
                      {x.meta}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function IconSpark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}
