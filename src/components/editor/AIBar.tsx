import { useEffect, useRef, useState } from "react";
import { useAI } from "../../store/ai";
import { useUI } from "../../store/ui";
import { openSettings } from "./SettingsModal";
import { Swatch } from "./MaterialBrowser";
import { IconSparkle, IconCheck, IconClose, IconChevron, IconArrowUp } from "../icons";

const SUGGESTIONS = [
  "Create a modern kitchen along the back wall.",
  "Add a second floor with stairs.",
  "Design a 2BHK apartment from scratch.",
  "Give me three variations.",
];

function ChangeList({ changes }: { changes: { label: string; detail?: string }[] }) {
  return (
    <ul className="space-y-1.5">
      {changes.map((c) => (
        <li key={c.label} className="flex items-baseline gap-2">
          <IconCheck size={12} className="mt-0.5 shrink-0 translate-y-px text-accent" />
          <span className="text-[12px] text-text">{c.label}</span>
          {c.detail && (
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-faint">
              — {c.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProposalCard() {
  const proposal = useAI((s) => s.proposal);
  const applyProposal = useAI((s) => s.applyProposal);
  const discardProposal = useAI((s) => s.discardProposal);
  const submit = useAI((s) => s.submit);

  if (!proposal) return null;

  return (
    <div className="pb-rise mb-2 w-[520px] max-w-[calc(100vw-48px)] border border-line bg-surface/95 shadow-pop backdrop-blur-md">
      <div className="border-b border-line px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent">
          <IconSparkle size={11} /> AI updated
        </p>
        <p className="mt-1 text-[13px] leading-snug text-text">{proposal.interpretation}</p>
      </div>
      <div className="px-3.5 py-3">
        <ChangeList changes={proposal.changes} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2">
        <button
          onClick={() => {
            applyProposal();
            useUI.getState().showToast("Changes applied");
          }}
          className="h-7 rounded-sm bg-accent px-3 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-void transition-opacity hover:opacity-85"
        >
          Apply
        </button>
        <button
          onClick={() => submit("Give me another variation")}
          className="h-7 rounded-sm px-2.5 font-mono text-[10.5px] uppercase tracking-wider text-dim transition-colors hover:bg-hover hover:text-text"
        >
          Try another variation
        </button>
        <span className="flex-1" />
        <button
          onClick={discardProposal}
          title="Discard"
          className="flex h-7 w-7 items-center justify-center rounded-sm text-faint transition-colors hover:bg-hover hover:text-text"
        >
          <IconClose size={13} />
        </button>
      </div>
    </div>
  );
}

function VariationsPanel() {
  const open = useUI((s) => s.variationsOpen);
  const setOpen = useUI((s) => s.setVariationsOpen);
  const variations = useAI((s) => s.variations);
  if (!open || !variations.length) return null;

  const thumbMats: Record<string, [string, string, string]> = {
    "Warm Modern": ["stone-travertine", "wood-walnut", "fabric-linen"],
    Minimal: ["concrete-polished", "wood-oak", "fabric-cotton"],
    "Contemporary Indian": ["stone-kota", "wood-teak", "fabric-velvet"],
  };
  const fallbackThumb = (title: string): [string, string, string] =>
    thumbMats[title] ?? ["stone-marble", "wood-walnut", "fabric-linen"];

  return (
    <div className="pb-rise mb-2 w-full max-w-[860px] border border-line bg-surface/95 shadow-pop backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent">
          Design variations · Living room
        </p>
        <button
          onClick={() => setOpen(false)}
          className="text-faint transition-colors hover:text-text"
        >
          <IconClose size={14} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line">
        {variations.map((v) => (
          <div key={v.id} className="bg-surface p-3.5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              Option {String(v.index).padStart(2, "0")}
            </p>
            <h4 className="mt-1 text-[15px] font-medium text-text">{v.title}</h4>
            {/* thumbnail composition */}
            <div className="relative mt-2.5 aspect-[16/9] overflow-hidden rounded-xs border border-line">
              <div className="absolute inset-0 flex">
                <div className="h-full flex-[2]"><Swatch materialId={fallbackThumb(v.title)[0]} size={64} /></div>
                <div className="h-full flex-1"><Swatch materialId={fallbackThumb(v.title)[1]} size={32} /></div>
                <div className="h-full flex-1"><Swatch materialId={fallbackThumb(v.title)[2]} size={32} /></div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <p className="mt-2 min-h-8 text-[11.5px] leading-snug text-dim">{v.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {v.materials.map((m) => (
                <span
                  key={m}
                  className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-faint"
                >
                  {m}
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                v.apply();
                setOpen(false);
                useUI.getState().showToast(`Applied · ${v.title}`);
              }}
              className="mt-3 h-7 w-full rounded-sm border border-accent-dim/60 font-mono text-[10.5px] uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-void"
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryPopover() {
  const [open, setOpen] = useState(false);
  const history = useAI((s) => s.history);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title="AI change history"
        disabled={!history.length}
        className="flex h-8 items-center gap-1 px-2 font-mono text-[10px] uppercase tracking-wider text-faint transition-colors hover:text-text disabled:pointer-events-none"
      >
        History
        <span className="rounded-xs bg-raised px-1 font-mono text-[9px]">{history.length}</span>
        <IconChevron size={11} className={`transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {open && (
        <div className="pb-rise absolute bottom-10 right-0 w-80 border border-line bg-surface shadow-pop">
          <div className="border-b border-line px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
            AI change history
          </div>
          <div className="max-h-72 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="border-b border-line/50 px-3 py-2.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[12px] text-text">“{h.command}”</p>
                  <span className="shrink-0 font-mono text-[9.5px] text-faint">{h.time}</span>
                </div>
                <div className="mt-1.5 opacity-80">
                  <ChangeList changes={h.changes} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AIBar() {
  const status = useAI((s) => s.status);
  const submit = useAI((s) => s.submit);
  const engineLabel = useAI((s) => s.engineLabel);
  const error = useAI((s) => s.error);
  const [value, setValue] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "thinking") {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    const open = () => useUI.getState().setVariationsOpen(true);
    window.addEventListener("prebuild:variations", open);
    return () => window.removeEventListener("prebuild:variations", open);
  }, []);

  const run = () => {
    if (!value.trim()) return;
    submit(value.trim());
    setValue("");
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center px-6">
      <div className="pointer-events-auto flex w-full max-w-[860px] flex-col items-center">
        {error && (
          <div className="pb-rise mb-2 rounded-sm border border-accent/30 bg-surface/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent backdrop-blur-md">
            {error}
          </div>
        )}
        <VariationsPanel />
        <ProposalCard />

        <div className="w-full rounded-md border border-line bg-base/95 shadow-pop backdrop-blur-md">
          {status === "thinking" ? (
            <div className="flex h-14 items-center gap-2.5 rounded-md px-5">
              <IconSparkle size={15} className="shrink-0 animate-pulse text-accent" />
              <span className="pb-shimmer text-[13px] font-medium">
                Asking {engineLabel}…
              </span>
              <span className="flex-1" />
              <span className="font-mono text-[10px] tracking-wider text-faint">
                {elapsed}s{elapsed > 25 ? " — large designs can take a couple of minutes" : ""}
              </span>
            </div>
          ) : (
            <div className="flex h-14 items-center gap-2 pl-5 pr-2">
              <IconSparkle size={15} className="shrink-0 text-accent" />
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="Describe what you want to change…"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-faint"
              />
              <button
                onClick={openSettings}
                title="Switch AI engine or add API keys"
                className="hidden shrink-0 cursor-pointer items-center gap-1 rounded-full border border-line bg-raised/70 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-widest text-dim transition-colors hover:border-line-strong hover:text-text sm:flex"
              >
                <span className="text-accent">◆</span> {engineLabel}
                <IconChevron size={10} className="rotate-90 opacity-60" />
              </button>
              <HistoryPopover />
              <button
                onClick={run}
                disabled={!value.trim()}
                title="Generate"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text text-base transition-all hover:opacity-80 disabled:opacity-25"
              >
                <IconArrowUp size={15} />
              </button>
            </div>
          )}

          {/* suggestion chips */}
          {status === "idle" && !value && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 px-4 py-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setValue(s)}
                  className="truncate rounded-full border border-line px-2.5 py-1 text-[11px] text-dim transition-colors hover:border-accent-dim hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
