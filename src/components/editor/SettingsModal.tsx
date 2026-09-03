import { useEffect, useState } from "react";
import {
  PROVIDER_META,
  refreshCliAvailability,
  useSettings,
  type ProviderId,
} from "../../store/settings";
import { resolveActive } from "../../lib/llm";
import { IconClose, IconCheck } from "../icons";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-accent" : "bg-line-strong"}`}
      title={ok ? "Ready" : "Not configured"}
    />
  );
}

function EngineRow({
  id,
  active,
  onSelect,
}: {
  id: Exclude<ProviderId, "auto">;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = PROVIDER_META[id];
  const keys = useSettings((s) => s.keys);
  const models = useSettings((s) => s.models);
  const cli = useSettings((s) => s.cliAvailable);
  const setKey = useSettings((s) => s.setKey);
  const setModel = useSettings((s) => s.setModel);

  let ready = false;
  if (id === "gemini") ready = Boolean(keys.gemini || import.meta.env.VITE_GEMINI_API_KEY);
  else if (id === "openai") ready = Boolean(keys.openai || import.meta.env.VITE_OPENAI_API_KEY);
  else if (id === "anthropic") ready = Boolean(keys.anthropic || import.meta.env.VITE_ANTHROPIC_API_KEY);
  else if (id === "nvidia") ready = Boolean(keys.nvidia || import.meta.env.VITE_NVIDIA_API_KEY);
  else if (id === "claude-code") ready = Boolean(cli.claude);
  else if (id === "opencode") ready = Boolean(cli.opencode);
  else ready = true;

  return (
    <div
      className={`border p-3 transition-colors ${
        active ? "border-accent/60 bg-accent/5" : "border-line hover:border-line-strong"
      }`}
    >
      <button onClick={onSelect} className="flex w-full items-center gap-2.5 text-left">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
            active ? "border-accent bg-accent" : "border-line-strong"
          }`}
        >
          {active && <IconCheck size={10} className="text-void" />}
        </span>
        <span className="flex-1 text-[13px] font-medium text-text">{meta.label}</span>
        <StatusDot ok={ready} />
      </button>

      <p className="mb-2 mt-1 pl-[26px] font-mono text-[9.5px] uppercase tracking-wider text-faint/80">
        {ready ? meta.hint : `Not ready — ${meta.hint}`}
        {!meta.vision && meta.kind !== "local" && " · no image input (plan import unavailable)"}
      </p>

      {(id === "gemini" || id === "openai" || id === "anthropic" || id === "nvidia") && (
        <div className="ml-[26px] grid grid-cols-[1fr_130px] gap-1.5">
          <input
            type="password"
            value={keys[id] ?? ""}
            onChange={(e) => setKey(id, e.target.value)}
            placeholder="API key…"
            spellCheck={false}
            autoComplete="off"
            className="h-7 rounded-xs border border-line bg-raised/60 px-2 font-mono text-[11px] text-text outline-none placeholder:text-faint focus:border-accent-dim"
          />
          <input
            type="text"
            value={models[id] ?? ""}
            onChange={(e) => setModel(id, e.target.value)}
            placeholder={meta.defaultModel}
            spellCheck={false}
            className="h-7 rounded-xs border border-line bg-raised/60 px-2 font-mono text-[11px] text-dim outline-none placeholder:text-faint focus:border-accent-dim"
          />
        </div>
      )}
    </div>
  );
}

export function SettingsModal() {
  const [open, setOpen] = useUIOpen();
  const close = () => setOpen(false);
  const provider = useSettings((s) => s.provider);
  const setProvider = useSettings((s) => s.setProvider);

  useEffect(() => {
    if (!open) return;
    refreshCliAvailability();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!open) return null;
  const active = resolveActive();

  return (
    <div
      className="pb-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="pb-rise flex max-h-[86vh] w-[480px] flex-col overflow-hidden rounded-md border border-line bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="text-[14px] font-medium text-text">AI Engines</h3>
            <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
              Currently serving · {PROVIDER_META[active.provider].short}
              {!active.ready && " (not ready → falling back to local)"}
            </p>
          </div>
          <button onClick={close} className="text-faint transition-colors hover:text-text">
            <IconClose size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {/* Auto */}
          <button
            onClick={() => setProvider("auto")}
            className={`flex w-full items-center gap-2.5 rounded-sm border p-3 text-left transition-colors ${
              provider === "auto" ? "border-accent/60 bg-accent/5" : "border-line hover:border-line-strong"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                provider === "auto" ? "border-accent bg-accent" : "border-line-strong"
              }`}
            >
              {provider === "auto" && <IconCheck size={10} className="text-void" />}
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium text-text">Auto</span>
              <span className="block font-mono text-[9.5px] uppercase tracking-wider text-faint/80">
                First ready engine: Gemini → OpenAI → Claude API → CLI agents
              </span>
            </span>
          </button>

          <EngineRow id="gemini" active={provider === "gemini"} onSelect={() => setProvider("gemini")} />
          <EngineRow id="openai" active={provider === "openai"} onSelect={() => setProvider("openai")} />
          <EngineRow id="anthropic" active={provider === "anthropic"} onSelect={() => setProvider("anthropic")} />
          <EngineRow id="nvidia" active={provider === "nvidia"} onSelect={() => setProvider("nvidia")} />
          <EngineRow id="claude-code" active={provider === "claude-code"} onSelect={() => setProvider("claude-code")} />
          <EngineRow id="opencode" active={provider === "opencode"} onSelect={() => setProvider("opencode")} />
          <EngineRow id="local" active={provider === "local"} onSelect={() => setProvider("local")} />
        </div>

        <div className="border-t border-line px-4 py-2.5">
          <p className="font-mono text-[9px] leading-relaxed tracking-wide text-faint/70">
            KEYS ARE STORED IN THIS BROWSER ONLY (LOCALSTORAGE). CLI AGENTS RUN ON YOUR MACHINE
            THROUGH THE DEV-SERVER BRIDGE AND USE YOUR OWN TERMINAL LOGIN.
          </p>
        </div>
      </div>
    </div>
  );
}

/* tiny local open-state so other components can toggle via a custom event */
function useUIOpen(): [boolean, (v: boolean) => void] {
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    const show = () => setOpenState(true);
    window.addEventListener("prebuild:settings", show);
    return () => window.removeEventListener("prebuild:settings", show);
  }, []);
  return [open, setOpenState];
}

export function openSettings() {
  window.dispatchEvent(new CustomEvent("prebuild:settings"));
}
