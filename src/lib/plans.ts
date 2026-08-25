import { llmJSON, hasVisionEngine } from "./llm";
import type { Part, SceneObject } from "../types";

export interface PlanWall {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface PlanRoom {
  name: string;
  /** center in meters */
  x: number;
  z: number;
  w: number;
  d: number;
}

export type PlanItemKind =
  | "sofa"
  | "table"
  | "chair"
  | "bed"
  | "wardrobe"
  | "plant"
  | "lamp"
  | "counter";

export interface PlanItem {
  kind: PlanItemKind;
  x: number;
  z: number;
  w: number;
  d: number;
  rotDeg?: number;
}

export interface LayoutPlan {
  exteriorW: number;
  exteriorD: number;
  walls: PlanWall[];
  rooms: PlanRoom[];
  items: PlanItem[];
}

/* ---------- Gemini vision detection ---------- */

const PROMPT = `You are an architectural draftsperson. This image is a 2D floor plan.
Convert it into a metric 3D-ready layout.

COORDINATE SYSTEM: origin at the CENTER of the building footprint, +X to the right (east), +Z downward in the image (south). All values are meters (numbers only).

Respond with STRICT JSON only:
{
  "exteriorW": <number>,
  "exteriorD": <number>,
  "walls": [{ "x1": n, "z1": n, "x2": n, "z2": n }],
  "rooms": [{ "name": "Living", "x": n, "z": n, "w": n, "d": n }],
  "items": [{ "kind": "sofa|table|chair|bed|wardrobe|plant|lamp|counter", "x": n, "z": n, "w": n, "d": n, "rotDeg": 0 }]
}

RULES:
- walls: outer envelope segments first, then interior partitions; use wall CENTERLINES; merge collinear segments; leave gaps for door openings where clearly drawn.
- rooms: one entry per labeled/obvious room with its bounding box (center + size).
- items: at most 14 furniture pieces placed plausibly inside rooms (sofa ≈ 2.2×0.9 m, bed ≈ 1.8×2.1 m, table ≈ 1.6×0.9 m).`;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

const KINDS: PlanItemKind[] = ["sofa", "table", "chair", "bed", "wardrobe", "plant", "lamp", "counter"];

export function normalizePlan(raw: unknown): LayoutPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const wallsRaw = Array.isArray(r.walls) ? r.walls : [];
  const roomsRaw = Array.isArray(r.rooms) ? r.rooms : [];
  const itemsRaw = Array.isArray(r.items) ? r.items : [];

  const walls: PlanWall[] = wallsRaw.slice(0, 40).map((w) => {
    const o = w as Record<string, unknown>;
    return {
      x1: num(o.x1),
      z1: num(o.z1),
      x2: num(o.x2),
      z2: num(o.z2),
    };
  }).filter((w) => Math.hypot(w.x2 - w.x1, w.z2 - w.z1) > 0.3);

  const rooms: PlanRoom[] = roomsRaw.slice(0, 16).map((rm, i) => {
    const o = rm as Record<string, unknown>;
    return {
      name: String(o.name ?? `Room ${i + 1}`).slice(0, 24),
      x: num(o.x),
      z: num(o.z),
      w: clamp(num(o.w, 3), 0.8, 20),
      d: clamp(num(o.d, 3), 0.8, 20),
    };
  }).filter((rm) => rm.w * rm.d > 1);

  const items: PlanItem[] = itemsRaw.slice(0, 16).map((it, i) => {
    const o = it as Record<string, unknown>;
    const kindRaw = String(o.kind ?? "table").toLowerCase();
    const kind = (KINDS.find((k) => kindRaw.includes(k)) ?? "table") as PlanItemKind;
    return {
      kind,
      x: num(o.x),
      z: num(o.z),
      w: clamp(num(o.w, 1), 0.3, 6),
      d: clamp(num(o.d, 1), 0.3, 6),
      rotDeg: num(o.rotDeg, 0),
    };
  });

  return {
    exteriorW: clamp(num(r.exteriorW, 12), 4, 60) || 12,
    exteriorD: clamp(num(r.exteriorD, 9), 4, 60) || 9,
    walls,
    rooms,
    items,
  };
}

export async function detectPlanFromImage(
  dataUrl: string,
): Promise<LayoutPlan> {
  if (!hasVisionEngine())
    throw new Error("NO_VISION_ENGINE");
  const raw = await llmJSON(PROMPT, dataUrl);
  return normalizePlan(raw);
}

/* ---------- sample plan (works offline / without API key) ---------- */

export const SAMPLE_PLAN: LayoutPlan = {
  exteriorW: 12,
  exteriorD: 8.5,
  walls: [
    // envelope
    { x1: -6, z1: -4.25, x2: 6, z2: -4.25 },
    { x1: 6, z1: -4.25, x2: 6, z2: 4.25 },
    { x1: 6, z1: 4.25, x2: -6, z2: 4.25 },
    { x1: -6, z1: 4.25, x2: -6, z2: -4.25 },
    // interior partitions (with door gaps)
    { x1: -1, z1: -4.25, x2: -1, z2: -2.6 },
    { x1: -1, z1: -0.9, x2: -1, z2: 4.25 },
    { x1: -1, z1: 1.2, x2: -6, z2: 1.2 },
    { x1: 2.2, z1: -4.25, x2: 2.2, z2: -1.8 },
  ],
  rooms: [
    { name: "Living Room", x: 2.4, z: 0.4, w: 7.2, d: 7.7 },
    { name: "Kitchen", x: 4.1, z: -3, w: 3.8, d: 2.5 },
    { name: "Bedroom 1", x: -3.5, z: 2.7, w: 5, d: 3.1 },
    { name: "Bedroom 2", x: -3.5, z: -1.5, w: 5, d: 5.5 },
  ],
  items: [
    { kind: "sofa", x: 2.6, z: 2.4, w: 2.6, d: 1, rotDeg: 180 },
    { kind: "table", x: 2.6, z: 0.4, w: 1.4, d: 0.75, rotDeg: 90 },
    { kind: "plant", x: 5.2, z: 3.5, w: 0.8, d: 0.8 },
    { kind: "counter", x: 4.2, z: -3.9, w: 3.4, d: 0.65 },
    { kind: "bed", x: -4.4, z: 2.9, w: 1.9, d: 2.2 },
    { kind: "wardrobe", x: -1.6, z: 3.9, w: 1.8, d: 0.65 },
    { kind: "bed", x: -4.4, z: -2.9, w: 1.9, d: 2.2, rotDeg: 0 },
    { kind: "lamp", x: 0.4, z: -3.6, w: 0.45, d: 0.45 },
    { kind: "chair", x: 4.8, z: 1.2, w: 0.8, d: 0.8, rotDeg: -30 },
  ],
};

/* ---------- scene builder ---------- */

const WALL_H = 3;
const WALL_T = 0.24;

function floorMaterialFor(roomName: string): string {
  const n = roomName.toLowerCase();
  if (/bath|toilet|wash/.test(n)) return "tile-ceramic";
  if (/kitchen/.test(n)) return "tile-porcelain";
  if (/bed/.test(n)) return "wood-oak";
  if (/balcony|terrace|deck/.test(n)) return "wood-teak";
  if (/garage|park|store|util/.test(n)) return "concrete-polished";
  if (/living|lounge|drawing|hall|dining|lobby/.test(n)) return "stone-marble";
  return "tile-porcelain";
}

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${++uid}`;

function baseObject(partial: Omit<SceneObject, "castShadow" | "receiveShadow" | "visible"> & Partial<SceneObject>): SceneObject {
  return {
    visible: true,
    castShadow: true,
    receiveShadow: true,
    ...partial,
  } as SceneObject;
}

function itemParts(kind: PlanItemKind, w: number, d: number): Part[] {
  switch (kind) {
    case "sofa":
      return [
        { geo: { kind: "box", size: [w, 0.38, d] }, offset: [0, 0.19, 0] },
        { geo: { kind: "box", size: [w, 0.55, 0.22] }, offset: [0, 0.62, d / 2 - 0.11], color: "#cfc6b6" },
        { geo: { kind: "box", size: [0.22, 0.52, d] }, offset: [-w / 2 + 0.11, 0.45, 0] },
        { geo: { kind: "box", size: [0.22, 0.52, d] }, offset: [w / 2 - 0.11, 0.45, 0] },
      ];
    case "table":
      return [
        { geo: { kind: "box", size: [w, 0.06, d] }, offset: [0, 0.72, 0] },
        { geo: { kind: "box", size: [0.07, 0.69, 0.07] }, offset: [-w / 2 + 0.08, 0.345, -d / 2 + 0.08] },
        { geo: { kind: "box", size: [0.07, 0.69, 0.07] }, offset: [w / 2 - 0.08, 0.345, -d / 2 + 0.08] },
        { geo: { kind: "box", size: [0.07, 0.69, 0.07] }, offset: [-w / 2 + 0.08, 0.345, d / 2 - 0.08] },
        { geo: { kind: "box", size: [0.07, 0.69, 0.07] }, offset: [w / 2 - 0.08, 0.345, d / 2 - 0.08] },
      ];
    case "chair":
      return [
        { geo: { kind: "box", size: [w, 0.12, d] }, offset: [0, 0.44, 0] },
        { geo: { kind: "box", size: [w, 0.5, 0.09] }, offset: [0, 0.72, d / 2 - 0.05] },
      ];
    case "bed":
      return [
        { geo: { kind: "box", size: [w, 0.28, d] }, offset: [0, 0.24, 0], materialId: "fabric-cotton" },
        { geo: { kind: "box", size: [w, 0.18, d * 0.62] }, offset: [0, 0.47, -d * 0.14], materialId: "fabric-linen" },
        { geo: { kind: "box", size: [w, 0.9, 0.12] }, offset: [0, 0.55, -d / 2 + 0.06], materialId: "wood-walnut" },
        { geo: { kind: "box", size: [w * 0.35, 0.1, 0.32] }, offset: [-w * 0.22, 0.61, -d * 0.36], materialId: "paint-white" },
        { geo: { kind: "box", size: [w * 0.35, 0.1, 0.32] }, offset: [w * 0.22, 0.61, -d * 0.36], materialId: "paint-white" },
      ];
    case "wardrobe":
      return [
        { geo: { kind: "box", size: [w, 2.2, d] }, offset: [0, 1.1, 0], materialId: "wood-teak" },
        { geo: { kind: "box", size: [0.03, 0.3, 0.03] }, offset: [-0.15, 1.15, d / 2 + 0.02], materialId: "metal-brass" },
        { geo: { kind: "box", size: [0.03, 0.3, 0.03] }, offset: [0.15, 1.15, d / 2 + 0.02], materialId: "metal-brass" },
      ];
    case "plant":
      return [
        { geo: { kind: "cylinder", radius: Math.min(w, d) / 2.4, height: 0.4 }, offset: [0, 0.2, 0], materialId: "concrete-textured" },
        { geo: { kind: "cylinder", radius: 0.04, height: 0.9 }, offset: [0, 0.85, 0], color: "#5a4632", roughness: 0.9 },
        { geo: { kind: "sphere", radius: 0.42 }, offset: [0.05, 1.55, 0], color: "#4a6b45", roughness: 0.85 },
        { geo: { kind: "sphere", radius: 0.28 }, offset: [-0.26, 1.3, 0.1], color: "#55764e", roughness: 0.85 },
      ];
    case "lamp":
      return [
        { geo: { kind: "cylinder", radius: 0.16, height: 0.03 }, offset: [0, 0.015, 0], materialId: "metal-black" },
        { geo: { kind: "cylinder", radius: 0.02, height: 1.6 }, offset: [0, 0.8, 0], materialId: "metal-black" },
        { geo: { kind: "cone", radius: 0.19, height: 0.26 }, offset: [0, 1.68, 0], materialId: "fabric-linen" },
        { geo: { kind: "sphere", radius: 0.06 }, offset: [0, 1.6, 0], color: "#ffe2b0", emissiveIntensity: 2.2 },
      ];
    case "counter":
      return [
        { geo: { kind: "box", size: [w, 0.85, d] }, offset: [0, 0.425, 0], materialId: "concrete-polished" },
        { geo: { kind: "box", size: [w + 0.04, 0.05, d + 0.04] }, offset: [0, 0.875, 0], materialId: "stone-marble" },
      ];
  }
}

export function buildSceneFromPlan(plan: LayoutPlan): SceneObject[] {
  uid = 0;
  const objects: SceneObject[] = [];

  // Base slab
  objects.push(
    baseObject({
      id: nextId("floor"),
      name: "Ground Slab",
      category: "floors",
      position: [0, -0.09, 0],
      rotationY: 0,
      scale: [1, 1, 1],
      materialId: "stone-marble",
      parts: [{ geo: { kind: "box", size: [plan.exteriorW + 0.8, 0.18, plan.exteriorD + 0.8] } }],
    }),
  );

  // Room floor overlays
  for (const room of plan.rooms) {
    objects.push(
      baseObject({
        id: nextId("rfloor"),
        name: `${room.name} · Floor`,
        category: "floors",
        position: [room.x, 0.005, room.z],
        rotationY: 0,
        scale: [1, 1, 1],
        materialId: floorMaterialFor(room.name),
        castShadow: false,
        parts: [{ geo: { kind: "box", size: [room.w, 0.02, room.d] } }],
      }),
    );
  }

  // Walls
  plan.walls.forEach((wall, i) => {
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) return;
    objects.push(
      baseObject({
        id: nextId("wall"),
        name: `Wall ${String(i + 1).padStart(2, "0")}`,
        category: "walls",
        position: [(wall.x1 + wall.x2) / 2, WALL_H / 2, (wall.z1 + wall.z2) / 2],
        rotationY: Math.atan2(-dz, dx),
        scale: [1, 1, 1],
        materialId: "paint-white",
        parts: [{ geo: { kind: "box", size: [len + WALL_T, WALL_H, WALL_T] } }],
      }),
    );
  });

  // Furniture
  plan.items.forEach((item, i) => {
    const label = `${item.kind.charAt(0).toUpperCase()}${item.kind.slice(1)} ${i + 1}`;
    objects.push(
      baseObject({
        id: nextId("item"),
        name: label,
        category: item.kind === "lamp" ? "fixtures" : item.kind === "plant" ? "plants" : "furniture",
        position: [item.x, 0, item.z],
        rotationY: ((item.rotDeg ?? 0) * Math.PI) / 180,
        scale: [1, 1, 1],
        materialId: item.kind === "sofa" ? "fabric-linen" : item.kind === "table" ? "wood-walnut" : item.kind === "chair" ? "fabric-velvet" : "wood-oak",
        parts: itemParts(item.kind, item.w, item.d),
      }),
    );
  });

  return objects;
}
