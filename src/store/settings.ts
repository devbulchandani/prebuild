import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProviderId =
  | "auto"
  | "gemini"
  | "openai"
  | "anthropic"
  | "claude-code"
  | "opencode"
  | "local";

export interface ProviderMeta {
  label: string;
  short: string;
  kind: "cloud" | "cli" | "local";
  vision: boolean;
  defaultModel: string;
  hint: string;
}

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  auto: { label: "Auto — first available", short: "Auto", kind: "cloud", vision: true, defaultModel: "", hint: "Uses the first configured engine below" },
  gemini: { label: "Google Gemini", short: "Gemini", kind: "cloud", vision: true, defaultModel: "gemini-2.5-flash", hint: "Get a key at aistudio.google.com/apikey" },
  openai: { label: "OpenAI", short: "OpenAI", kind: "cloud", vision: true, defaultModel: "gpt-4o-mini", hint: "Get a key at platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic (Claude)", short: "Claude API", kind: "cloud", vision: true, defaultModel: "claude-sonnet-4-5", hint: "Get a key at console.anthropic.com" },
  "claude-code": { label: "Claude Code · local CLI", short: "Claude Code", kind: "cli", vision: false, defaultModel: "", hint: "Runs the claude CLI locally via the dev-server bridge" },
  opencode: { label: "OpenCode · local CLI", short: "OpenCode", kind: "cli", vision: false, defaultModel: "", hint: "Runs the opencode CLI locally via the dev-server bridge" },
  local: { label: "Built-in rules engine", short: "Local", kind: "local", vision: false, defaultModel: "", hint: "Offline keyword presets — always available" },
};

export type CloudKeyId = "gemini" | "openai" | "anthropic";
export type ModelableId = Exclude<ProviderId, "auto" | "local">;

interface SettingsState {
  provider: ProviderId;
  keys: Partial<Record<CloudKeyId, string>>;
  models: Partial<Record<ModelableId, string>>;
  cliAvailable: { opencode?: boolean; claude?: boolean };
  setProvider: (p: ProviderId) => void;
  setKey: (p: CloudKeyId, key: string) => void;
  setModel: (p: ModelableId, model: string) => void;
  setCliAvailable: (v: { opencode?: boolean; claude?: boolean }) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "auto",
      keys: {},
      models: {},
      cliAvailable: {},
      setProvider: (provider) => set({ provider }),
      setKey: (p, key) => set((s) => ({ keys: { ...s.keys, [p]: key } })),
      setModel: (p, model) => set((s) => ({ models: { ...s.models, [p]: model } })),
      setCliAvailable: (cliAvailable) => set({ cliAvailable }),
    }),
    {
      name: "prebuild.settings",
      partialize: (s) => ({ provider: s.provider, keys: s.keys, models: s.models }),
    },
  ),
);

/* Probe local CLIs through the dev-server bridge (dev only). */
export function refreshCliAvailability() {
  fetch("/api/cli-check")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { opencode?: boolean; claude?: boolean } | null) => {
      if (data) useSettings.getState().setCliAvailable(data);
    })
    .catch(() => {});
}
