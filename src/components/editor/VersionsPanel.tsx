import { useEffect, useRef, useState } from "react";
import { useVersions, type SceneVersion } from "../../store/versions";
import { useUI } from "../../store/ui";
import { IconCheck, IconClose, IconEye } from "../icons";

function relTime(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function VersionCard({ version }: { version: SceneVersion }) {
  const peek = useVersions((s) => s.peek);
  const restore = useVersions((s) => s.restore);
  const remove = useVersions((s) => s.remove);
  const rename = useVersions((s) => s.rename);
  const peekingId = useVersions((s) => s.peekingId);
  const showToast = useUI((s) => s.showToast);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(version.label);

  const isPeeking = peekingId === version.id;

  return (
    <div
      onMouseEnter={() => peek(version.id)}
      onMouseLeave={() => peek(null)}
      className={`group rounded-sm border p-2 transition-colors ${
        isPeeking ? "border-accent/60 bg-accent/5" : "border-line hover:border-line-strong"
      }`}
    >
      <div className="flex gap-2.5">
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xs border border-line bg-void">
          {version.thumbnail ? (
            <img src={version.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[8px] uppercase tracking-widest text-faint">
              no preview
            </div>
          )}
          {isPeeking && (
            <span className="absolute inset-0 flex items-center justify-center bg-accent/25">
              <IconEye size={16} className="text-accent-strong" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => {
                const final = label.trim();
                if (final && final !== version.label) rename(version.id, final);
                setLabel(final || version.label);
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full rounded-xs border border-accent-dim bg-raised px-1 text-[12px] text-text outline-none"
            />
          ) : (
            <button
              onDoubleClick={() => setEditing(true)}
              title="Double-click to rename"
              className="block w-full truncate text-left text-[12.5px] font-medium text-text"
            >
              {version.label}
            </button>
          )}
          <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
            {relTime(version.time)} ·{" "}
            {new Date(version.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>

          <div className="mt-1.5 flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => {
                peek(null);
                if (restore(version.id)) showToast(`Rolled back to · ${version.label}`);
              }}
              className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-dim transition-colors hover:border-accent/50 hover:text-accent"
            >
              Restore
            </button>
            <button
              onClick={() => remove(version.id)}
              title="Delete version"
              className="flex items-center rounded-xs border border-line px-1 py-0.5 text-faint transition-colors hover:border-line-strong hover:text-text"
            >
              <IconClose size={9} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VersionsPanel() {
  const versions = useVersions((s) => s.versions);
  const commit = useVersions((s) => s.commit);
  const showToast = useUI((s) => s.showToast);
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Stop hover-peek when leaving the whole panel
  const peek = useVersions((s) => s.peek);
  useEffect(() => () => peek(null), [peek]);

  const doCommit = () => {
    const v = commit(label || undefined);
    setLabel("");
    showToast(`Committed · ${v.label}`);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* commit bar */}
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <p className="mb-2 font-mono text-[9.5px] uppercase tracking-wider text-faint">
          Commit the current scene state
        </p>
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doCommit()}
            placeholder="e.g. Marble floor study"
            className="h-7 min-w-0 flex-1 rounded-xs border border-line bg-raised/60 px-2 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent-dim"
          />
          <button
            onClick={doCommit}
            className="flex h-7 shrink-0 items-center gap-1 rounded-sm bg-accent px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-void transition-opacity hover:opacity-85"
          >
            <IconCheck size={11} />
            Commit
          </button>
        </div>
      </div>

      {/* list */}
      <div
        className="flex-1 space-y-2 overflow-y-auto p-3"
        onMouseLeave={() => peek(null)}
      >
        {versions.length === 0 ? (
          <div className="mt-6 px-4 text-center">
            <p className="text-[12px] leading-relaxed text-dim">No versions yet.</p>
            <p className="mt-2 font-mono text-[9.5px] uppercase tracking-wider leading-relaxed text-faint/70">
              COMMIT A SNAPSHOT TO COMPARE
              <br />
              AND ROLL BACK LATER.
              <br />
              HOVER A VERSION TO PREVIEW IT
              <br />
              ON THE LIVE SCENE.
            </p>
          </div>
        ) : (
          versions.map((v) => <VersionCard key={v.id} version={v} />)
        )}
      </div>
    </div>
  );
}
