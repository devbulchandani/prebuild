import { create } from "zustand";
import { useScene } from "./scene";
import type { LightingState, MaterialDef, SceneObject } from "../types";

type Override = Partial<MaterialDef>;

export interface SceneVersion {
  id: string;
  label: string;
  time: number;
  thumbnail?: string;
  objects: Record<string, SceneObject>;
  lighting: LightingState;
  materialOverrides: Record<string, Override>;
}

interface LiveStash {
  objects: Record<string, SceneObject>;
  lighting: LightingState;
  materialOverrides: Record<string, Override>;
}

function captureThumbnail(): string | undefined {
  const source = document.querySelector("canvas");
  if (!source) return undefined;
  try {
    const w = 256;
    const h = Math.round((source.clientHeight / source.clientWidth) * w) || 160;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(source, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}

interface VersionsStore {
  versions: SceneVersion[];
  peekingId: string | null;
  commit: (label?: string) => SceneVersion;
  restore: (id: string) => boolean;
  remove: (id: string) => void;
  rename: (id: string, label: string) => void;
  peek: (id: string | null) => void;
}

let counter = 0;

export const useVersions = create<VersionsStore>((set, get) => {
  function live(): LiveStash {
    const s = useScene.getState();
    return {
      objects: structuredClone(s.objects),
      lighting: { ...s.lighting },
      materialOverrides: structuredClone(s.materialOverrides),
    };
  }

  function apply(v: Pick<SceneVersion, "objects" | "lighting" | "materialOverrides">) {
    useScene.setState({
      objects: structuredClone(v.objects),
      lighting: { ...v.lighting },
      materialOverrides: structuredClone(v.materialOverrides),
      selection: null,
    });
  }

  let stash: LiveStash | null = null;

  return {
    versions: [],
    peekingId: null,

    commit: (label) => {
      const version: SceneVersion = {
        id: crypto.randomUUID(),
        label: label?.trim() || `Version ${++counter}`,
        time: Date.now(),
        thumbnail: captureThumbnail(),
        ...live(),
      };
      set((s) => ({ versions: [version, ...s.versions].slice(0, 24) }));
      return version;
    },

    restore: (id) => {
      const v = get().versions.find((x) => x.id === id);
      if (!v) return false;
      // Safety: snapshot current state so a restore is itself undoable.
      useScene.setState((st) => ({
        past: [...st.past.slice(-49), { objects: st.objects, lighting: st.lighting, materialOverrides: st.materialOverrides }],
        future: [],
      }));
      apply(v);
      useScene.getState().touch();
      return true;
    },

    remove: (id) => set((s) => ({ versions: s.versions.filter((v) => v.id !== id) })),

    rename: (id, label) =>
      set((s) => ({
        versions: s.versions.map((v) => (v.id === id ? { ...v, label } : v)),
      })),

    /* Hover preview: temporarily show a version without touching undo stack. */
    peek: (id) => {
      if (id === get().peekingId) return;
      if (id) {
        const v = get().versions.find((x) => x.id === id);
        if (!v) return;
        if (!stash && !get().peekingId) stash = live();
        apply(v);
        set({ peekingId: id });
      } else {
        if (stash) {
          apply(stash);
          stash = null;
        }
        set({ peekingId: null });
      }
    },
  };
});
