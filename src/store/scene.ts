import { create } from "zustand";
import type { LightingState, SceneObject, Vec3 } from "../types";
import { createInitialObjects } from "../scene/villa";

interface Snapshot {
  objects: Record<string, SceneObject>;
  lighting: LightingState;
  materialOverrides: Record<string, Partial<import("../types").MaterialDef>>;
}

export type Selection =
  | { kind: "object"; id: string }
  | { kind: "system"; id: "sun" | "ceiling-lights" | "ambient" }
  | null;

export type MaterialOverride = { color?: string; roughness?: number; metalness?: number; opacity?: number };

interface SceneStore {
  projectName: string;
  saveStatus: "saved" | "saving" | "unsaved";
  objects: Record<string, SceneObject>;
  selection: Selection;
  lighting: LightingState;
  materialOverrides: Record<string, MaterialOverride>;
  past: Snapshot[];
  future: Snapshot[];

  select: (s: Selection) => void;
  setProjectName: (name: string) => void;
  addObject: (obj: SceneObject) => void;
  removeObject: (id: string) => void;
  updateObject: (id: string, patch: Partial<SceneObject>, opts?: { history?: boolean }) => void;
  applyMaterial: (objectId: string, materialId: string) => void;
  setMaterialProps: (materialId: string, patch: MaterialOverride, opts?: { history?: boolean }) => void;
  toggleVisibility: (id: string) => void;
  setLighting: (patch: Partial<LightingState>, opts?: { history?: boolean }) => void;
  replaceMaterials: (predicate: (o: SceneObject) => boolean, materialId: string) => void;
  setManyMaterials: (map: Record<string, string>) => void;
  pushUndo: () => void;
  replaceScene: (objects: SceneObject[]) => void;
  newProject: (name?: string) => void;
  touch: () => void;
  undo: () => void;
  redo: () => void;
}

const snapshot = (s: SceneStore): Snapshot => ({
  objects: structuredClone(s.objects),
  lighting: { ...s.lighting },
  materialOverrides: structuredClone(s.materialOverrides),
});

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useScene = create<SceneStore>((set, get) => {
  function mutate(fn: (draft: SceneStore) => void, history = true) {
    set((s) => {
      // Copy every mutable collection so zustand sees new references
      // (in-place mutation would leave subscribers stale).
      const draft = {
        ...s,
        objects: { ...s.objects },
        lighting: { ...s.lighting },
        materialOverrides: { ...s.materialOverrides },
      };
      fn(draft);
      const next: Partial<SceneStore> = {};
      if (history) {
        next.past = [...s.past.slice(-49), snapshot(s)];
        next.future = [];
        next.saveStatus = "unsaved";
      }
      return {
        ...next,
        ...pick(draft, ["objects", "lighting", "materialOverrides", "selection"]),
      };
    });
    get().touch();
  }

  return {
    projectName: "Villa Jaipur",
    saveStatus: "saved",
    objects: createInitialObjects(),
    selection: null,
    lighting: {
      timeOfDay: "day",
      sunIntensity: 1,
      ambientIntensity: 1,
      interiorLightsOn: false,
    },
    materialOverrides: {},
    past: [],
    future: [],

    select: (selection) => set({ selection }),

    addObject: (obj) =>
      mutate((d) => {
        d.objects[obj.id] = obj;
        d.selection = { kind: "object", id: obj.id };
      }),

    removeObject: (id) =>
      mutate((d) => {
        delete d.objects[id];
        if (d.selection?.kind === "object" && d.selection.id === id) d.selection = null;
      }),

    updateObject: (id, patch, opts) =>
      mutate((d) => {
        const o = d.objects[id];
        if (o) d.objects[id] = { ...o, ...patch };
      }, opts?.history ?? true),

    applyMaterial: (objectId, materialId) =>
      mutate((d) => {
        const o = d.objects[objectId];
        if (o) d.objects[objectId] = { ...o, materialId };
      }),

    setMaterialProps: (materialId, patch, opts) =>
      mutate((d) => {
        d.materialOverrides = {
          ...d.materialOverrides,
          [materialId]: { ...d.materialOverrides[materialId], ...patch },
        };
      }, opts?.history ?? true),

    toggleVisibility: (id) =>
      mutate((d) => {
        const o = d.objects[id];
        if (o) d.objects[id] = { ...o, visible: !o.visible };
      }),

    setLighting: (patch, opts) =>
      mutate((d) => {
        d.lighting = { ...d.lighting, ...patch };
      }, opts?.history ?? true),

    replaceMaterials: (predicate, materialId) =>
      mutate((d) => {
        for (const id of Object.keys(d.objects)) {
          if (predicate(d.objects[id])) {
            d.objects[id] = { ...d.objects[id], materialId };
          }
        }
      }),

    setManyMaterials: (map) =>
      mutate((d) => {
        for (const [id, m] of Object.entries(map)) {
          if (d.objects[id]) d.objects[id] = { ...d.objects[id], materialId: m };
        }
      }),

    pushUndo: () =>
      set((s) => ({
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        saveStatus: "unsaved",
      })),

    replaceScene: (objects) =>
      mutate((d) => {
        d.objects = Object.fromEntries(objects.map((o) => [o.id, o]));
        d.selection = null;
      }),

    newProject: (name) => {
      const slab: SceneObject = {
        id: "floor-base",
        name: "Base Slab",
        category: "floors",
        position: [0, -0.09, 0],
        rotationY: 0,
        scale: [1, 1, 1],
        visible: true,
        materialId: "concrete-polished",
        parts: [{ geo: { kind: "box", size: [12, 0.18, 8] } }],
        castShadow: true,
        receiveShadow: true,
      };
      set({
        projectName: name?.trim() || "Untitled Project",
        objects: { [slab.id]: slab },
        selection: null,
        lighting: {
          timeOfDay: "day",
          sunIntensity: 1,
          ambientIntensity: 1,
          interiorLightsOn: false,
        },
        materialOverrides: {},
        past: [],
        future: [],
        saveStatus: "saved",
      });
    },

    setProjectName: (name) =>
      set({ projectName: name.trim() || "Untitled Project", saveStatus: "unsaved" }),

    touch: () => {
      set({ saveStatus: "saving" });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => set({ saveStatus: "saved" }), 900);
    },

    undo: () => {
      const s = get();
      if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({
        past: s.past.slice(0, -1),
        future: [snapshot(s), ...s.future].slice(0, 50),
        objects: prev.objects,
        lighting: prev.lighting,
        materialOverrides: prev.materialOverrides,
        saveStatus: "unsaved",
      });
    },

    redo: () => {
      const s = get();
      if (!s.future.length) return;
      const next = s.future[0];
      set({
        past: [...s.past, snapshot(s)],
        future: s.future.slice(1),
        objects: next.objects,
        lighting: next.lighting,
        materialOverrides: next.materialOverrides,
        saveStatus: "unsaved",
      });
    },
  };
});

function pick<T extends object>(obj: T, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = (obj as Record<string, unknown>)[k];
  return out as Partial<T>;
}

export const fmtNum = (n: number) => Number(n.toFixed(2)).toString();
