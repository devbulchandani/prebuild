import { create } from "zustand";
import { useScene } from "./scene";
import { MATERIALS, getMaterial } from "../data/materials";
import { llmJSON, resolveActive } from "../lib/llm";
import { PROVIDER_META } from "./settings";
import { TEMPLATES, nextTemplateId, templateKeys } from "../lib/templates";
import { buildSceneFromPlan, normalizePlan, SAMPLE_PLAN, type LayoutPlan } from "../lib/plans";
import { useVersions } from "./versions";
import type { LightingState, SceneObject, TimeOfDay, Vec3 } from "../types";

export interface ChangeItem {
  label: string;
  detail?: string;
}

export type SceneOp =
  | { op: "setMaterial"; objectId: string; material: string }
  | { op: "setLighting"; timeOfDay?: TimeOfDay; sunIntensity?: number; ambientIntensity?: number; interiorLightsOn?: boolean }
  | { op: "setVisibility"; objectId: string; visible: boolean }
  | { op: "moveObject"; objectId: string; position: [number, number, number]; rotationYDeg?: number }
  | { op: "scaleObject"; objectId: string; scale: number }
  | {
      op: "addObject";
      template: string;
      position?: [number, number, number];
      size?: [number, number, number];
      rotationYDeg?: number;
      material?: string;
      name?: string;
    }
  | {
      op: "addWall";
      from: [number, number];
      to: [number, number];
      baseY?: number;
      height?: number;
      thickness?: number;
      material?: string;
    }
  | { op: "addRoom"; name?: string; x: number; z: number; w: number; d: number; floorMaterial?: string }
  | { op: "removeObject"; objectId: string }
  | { op: "clearScene" };

interface ScenePatch {
  interpretation: string;
  changes: ChangeItem[];
  operations: SceneOp[];
}

export interface SceneProposal {
  id: string;
  command: string;
  interpretation: string;
  changes: ChangeItem[];
  source: string;
  apply: () => void;
}

export interface Variation {
  id: string;
  index: number;
  title: string;
  description: string;
  materials: string[];
  apply: () => void;
}

export interface HistoryEntry {
  id: number;
  command: string;
  changes: ChangeItem[];
  time: string;
  source: string;
}

/* ---------- atomic operation executor (one undo entry per batch) ---------- */

function resolveMaterial(v: string): string | null {
  const lower = String(v).toLowerCase().trim();
  return (
    MATERIALS.find((m) => m.id.toLowerCase() === lower)?.id ??
    MATERIALS.find((m) => m.name.toLowerCase().includes(lower))?.id ??
    null
  );
}

const clamp01 = (n: unknown, fallback = 1) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : fallback;

const clampCoord = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(40, Math.max(-40, n)) : 0;

const clampElev = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(12, Math.max(0, n)) : 0;

let wallNumCounter = 0;
function nextWallNum(objects: Record<string, SceneObject>): string {
  void objects;
  return String(++wallNumCounter).padStart(2, "0");
}

export function executeOps(ops: SceneOp[]): ChangeItem[] {
  const s = useScene.getState();
  const objects: Record<string, SceneObject> = structuredClone(s.objects);
  const lighting: LightingState = { ...s.lighting };
  const changes: ChangeItem[] = [];

  for (const op of ops ?? []) {
    try {
      switch (op.op) {
        case "setMaterial": {
          if (!objects[op.objectId]) break;
          const matId = resolveMaterial(op.material);
          if (!matId || matId === objects[op.objectId].materialId) break;
          objects[op.objectId] = { ...objects[op.objectId], materialId: matId };
          changes.push({
            label: getMaterial(matId).name,
            detail: `on ${objects[op.objectId].name}`,
          });
          break;
        }
        case "setLighting": {
          let applied = false;
          if (op.timeOfDay && ["day", "sunset", "night"].includes(op.timeOfDay)) {
            if (op.timeOfDay !== lighting.timeOfDay) {
              lighting.timeOfDay = op.timeOfDay;
              applied = true;
            }
          }
          if (op.sunIntensity !== undefined && clamp01(op.sunIntensity) !== lighting.sunIntensity) {
            lighting.sunIntensity = clamp01(op.sunIntensity);
            applied = true;
          }
          if (op.ambientIntensity !== undefined && clamp01(op.ambientIntensity, 0.9) !== lighting.ambientIntensity) {
            lighting.ambientIntensity = clamp01(op.ambientIntensity, 0.9);
            applied = true;
          }
          if (typeof op.interiorLightsOn === "boolean" && op.interiorLightsOn !== lighting.interiorLightsOn) {
            lighting.interiorLightsOn = op.interiorLightsOn;
            applied = true;
          }
          if (applied)
            changes.push({
              label: "Lighting",
              detail: `${lighting.timeOfDay}${lighting.interiorLightsOn ? " · interior on" : ""}`,
            });
          break;
        }
        case "setVisibility": {
          if (!objects[op.objectId]) break;
          objects[op.objectId] = { ...objects[op.objectId], visible: !!op.visible };
          changes.push({
            label: objects[op.objectId].name,
            detail: op.visible ? "shown" : "hidden",
          });
          break;
        }
        case "moveObject": {
          if (!objects[op.objectId]) break;
          if (!Array.isArray(op.position) || op.position.length !== 3) break;
          objects[op.objectId] = {
            ...objects[op.objectId],
            position: op.position.map((n) => Math.max(-30, Math.min(30, Number(n) || 0))) as [number, number, number],
            rotationY:
              typeof op.rotationYDeg === "number" ? (op.rotationYDeg * Math.PI) / 180 : objects[op.objectId].rotationY,
          };
          changes.push({ label: objects[op.objectId].name, detail: "moved" });
          break;
        }
        case "scaleObject": {
          if (!objects[op.objectId]) break;
          const k = Math.min(3, Math.max(0.25, Number(op.scale) || 1));
          objects[op.objectId] = { ...objects[op.objectId], scale: [k, k, k] };
          changes.push({ label: objects[op.objectId].name, detail: `scaled ×${k}` });
          break;
        }

        /* ---------- constructive operations ---------- */

        case "addObject": {
          const def = TEMPLATES[String(op.template ?? "").toLowerCase()];
          if (!def) break;
          const [dw, dh, dd] = def.defaultSize;
          const dim = (n: number | undefined, fallback: number) =>
            Math.min(30, Math.max(0.05, Number(n) || fallback));
          const w = dim(op.size?.[0], dw);
          const h = dim(op.size?.[1], dh);
          const d = dim(op.size?.[2], dd);
          const pos: Vec3 = [
            clampCoord(op.position?.[0]),
            op.position?.[1] !== undefined ? clampCoord(op.position[1]) : 0,
            clampCoord(op.position?.[2]),
          ];
          const id = nextTemplateId(String(op.template).toLowerCase());
          const name =
            (op.name || "").trim() ||
            String(op.template)
              .split("-")
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(" ");
          objects[id] = {
            id,
            name,
            category: def.category,
            position: pos,
            rotationY: ((op.rotationYDeg ?? 0) * Math.PI) / 180,
            scale: [1, 1, 1],
            visible: true,
            materialId: resolveMaterial(op.material ?? "") ?? def.materialId,
            parts: def.build(w, h, d),
            castShadow: true,
            receiveShadow: true,
          };
          changes.push({
            label: `Added ${name}`,
            detail: `${w.toFixed(1)}×${d.toFixed(1)}m at (${pos[0].toFixed(1)}, ${pos[2].toFixed(1)})`,
          });
          break;
        }

        case "addWall": {
          if (!Array.isArray(op.from) || !Array.isArray(op.to)) break;
          const [x1, z1] = op.from.map(clampCoord) as [number, number];
          const [x2, z2] = op.to.map(clampCoord) as [number, number];
          const len = Math.hypot(x2 - x1, z2 - z1);
          if (len < 0.3) break;
          const hgt = Math.min(6, Math.max(0.5, Number(op.height) || 3));
          const base = clampElev(op.baseY);
          const thick = Math.min(1, Math.max(0.08, Number(op.thickness) || 0.24));
          const id = nextTemplateId("wall");
          objects[id] = {
            id,
            name: `Wall ${nextWallNum(objects)}`,
            category: "walls",
            position: [(x1 + x2) / 2, base + hgt / 2, (z1 + z2) / 2],
            rotationY: Math.atan2(-(z2 - z1), x2 - x1),
            scale: [1, 1, 1],
            visible: true,
            materialId: resolveMaterial(op.material ?? "") ?? "paint-white",
            parts: [{ geo: { kind: "box", size: [len + thick, hgt, thick] } }],
            castShadow: true,
            receiveShadow: true,
          };
          changes.push({ label: `Added wall`, detail: `${len.toFixed(1)}m at y=${base.toFixed(1)}` });
          break;
        }

        case "addRoom": {
          const w = Math.min(20, Math.max(1.5, Number(op.w) || 4));
          const d = Math.min(20, Math.max(1.5, Number(op.d) || 4));
          const cx = clampCoord(op.x);
          const cz = clampCoord(op.z);
          const name = (op.name || "New Room").slice(0, 28);
          const floorMat = resolveMaterial(op.floorMaterial ?? "") ?? "tile-porcelain";
          const H = 3;
          const T = 0.24;
          const doorW = 1;

          // floor overlay
          const fid = nextTemplateId("room-floor");
          objects[fid] = {
            id: fid,
            name: `${name} · Floor`,
            category: "floors",
            position: [cx, 0.005, cz],
            rotationY: 0,
            scale: [1, 1, 1],
            visible: true,
            materialId: floorMat,
            parts: [{ geo: { kind: "box", size: [w, 0.02, d] } }],
            castShadow: false,
            receiveShadow: true,
          };

          // perimeter walls with a door gap centered on the south edge
          const mkWall = (idp: string, x1: number, z1: number, x2: number, z2: number) => {
            const len = Math.hypot(x2 - x1, z2 - z1);
            if (len < 0.3) return;
            objects[idp] = {
              id: idp,
              name: `${name} · Wall`,
              category: "walls",
              position: [(x1 + x2) / 2, H / 2, (z1 + z2) / 2],
              rotationY: Math.atan2(-(z2 - z1), x2 - x1),
              scale: [1, 1, 1],
              visible: true,
              materialId: "paint-white",
              parts: [{ geo: { kind: "box", size: [len + T, H, T] } }],
              castShadow: true,
              receiveShadow: true,
            };
          };
          const hw = w / 2;
          const hd = d / 2;
          mkWall(nextTemplateId("room-wall"), cx - hw, cz - hd, cx + hw, cz - hd); // north
          mkWall(nextTemplateId("room-wall"), cx - hw, cz - hd, cx - hw, cz + hd); // west
          mkWall(nextTemplateId("room-wall"), cx + hw, cz - hd, cx + hw, cz + hd); // east
          // south wall with gap
          const gapL = cx - doorW / 2;
          const gapR = cx + doorW / 2;
          mkWall(nextTemplateId("room-wall"), cx - hw, cz + hd, gapL, cz + hd);
          mkWall(nextTemplateId("room-wall"), gapR, cz + hd, cx + hw, cz + hd);

          changes.push({ label: `Created ${name}`, detail: `${w.toFixed(1)}×${d.toFixed(1)}m room` });
          break;
        }

        case "removeObject": {
          const victim = objects[op.objectId];
          if (!victim) break;
          delete objects[op.objectId];
          changes.push({ label: victim.name, detail: "removed" });
          break;
        }

        case "clearScene": {
          const n = Object.keys(objects).length;
          for (const id of Object.keys(objects)) delete objects[id];
          if (n) changes.push({ label: "Scene cleared", detail: `${n} objects removed` });
          break;
        }
      }
    } catch {
      /* skip malformed op */
    }
  }

  // Only commit an undo point when something actually changed.
  if (changes.length === 0) return changes;

  useScene.setState((st) => ({
    past: [...st.past.slice(-49), { objects: st.objects, lighting: st.lighting, materialOverrides: st.materialOverrides }],
    future: [],
    objects,
    lighting,
    selection: null,
    saveStatus: "unsaved",
  }));
  useScene.getState().touch();
  return changes;
}

/* ---------- engine context ---------- */

/** Approximate world-space footprint of an object from its parts. */
function objFootprint(o: SceneObject): Vec3 {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of o.parts) {
    const s =
      p.geo.kind === "box"
        ? p.geo.size
        : p.geo.kind === "cylinder" || p.geo.kind === "cone"
          ? ([p.geo.radius * 2, p.geo.height, p.geo.radius * 2] as Vec3)
          : ([p.geo.radius * 2, p.geo.radius * 2, p.geo.radius * 2] as Vec3);
    const off = p.offset ?? [0, 0, 0];
    minX = Math.min(minX, off[0] - s[0] / 2);
    maxX = Math.max(maxX, off[0] + s[0] / 2);
    minY = Math.min(minY, off[1] - s[1] / 2);
    maxY = Math.max(maxY, off[1] + s[1] / 2);
    minZ = Math.min(minZ, off[2] - s[2] / 2);
    maxZ = Math.max(maxZ, off[2] + s[2] / 2);
  }
  if (!Number.isFinite(minX)) return [1, 1, 1];
  const sc = o.scale;
  return [(maxX - minX) * sc[0], (maxY - minY) * sc[1], (maxZ - minZ) * sc[2]];
}

/* ---------- Gemini protocol ---------- */

function buildContext(compact = false): string {
  const s = useScene.getState();
  const objs = Object.values(s.objects);
  const objectList = objs
    .slice(0, compact ? 45 : 90)
    .map((o) => {
      const [w, h, d] = objFootprint(o);
      return `- ${o.id} · "${o.name}" · ${o.category} · pos(${o.position[0].toFixed(1)}, ${o.position[1].toFixed(1)}, ${o.position[2].toFixed(1)}) · rotY ${(o.rotationY * 57.3).toFixed(0)}° · ${w.toFixed(1)}×${h.toFixed(1)}×${d.toFixed(1)}m · material: ${o.materialId}${o.visible ? "" : " · HIDDEN"}`;
    })
    .join("\n");

  let bounds = "empty";
  if (objs.length) {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const o of objs) {
      if (["floors", "walls"].includes(o.category) && !o.visible) continue;
      const [w, , d] = objFootprint(o);
      minX = Math.min(minX, o.position[0] - w / 2);
      maxX = Math.max(maxX, o.position[0] + w / 2);
      minZ = Math.min(minZ, o.position[2] - d / 2);
      maxZ = Math.max(maxZ, o.position[2] + d / 2);
    }
    if (Number.isFinite(minX))
      bounds = `x ∈ [${minX.toFixed(1)}, ${maxX.toFixed(1)}], z ∈ [${minZ.toFixed(1)}, ${maxZ.toFixed(1)}]`;
  }

  const byCat = objs.reduce<Record<string, number>>((acc, o) => {
    acc[o.category] = (acc[o.category] ?? 0) + 1;
    return acc;
  }, {});
  const catSummary = Object.entries(byCat)
    .map(([k, v]) => `${k}:${v}`)
    .join(" · ");

  const materialList = MATERIALS.map((m) => `- ${m.id} (${m.name})`).join("\n");
  return `CURRENT SCENE OBJECTS (${objs.length} total — ${catSummary || "none"}):
${objectList || "(empty scene — use build operations)"}

SCENE BOUNDS: ${bounds}

AVAILABLE MATERIALS (use id or exact name):
${materialList}

CURRENT LIGHTING: timeOfDay=${s.lighting.timeOfDay}, sunIntensity=${s.lighting.sunIntensity.toFixed(2)}, ambientIntensity=${s.lighting.ambientIntensity.toFixed(2)}, interiorLightsOn=${s.lighting.interiorLightsOn}`;
}

function systemPrompt(command: string, compact = false): string {
  return `You are Prebuild AI, an architectural design assistant operating on a live 3D scene (units: meters, +Y up).

USER COMMAND: "${command}"

${buildContext(compact)}

You can BOTH modify existing objects AND BUILD NEW GEOMETRY. Operation reference:

MODIFY:
- { "op": "setMaterial", "objectId": "<id>", "material": "<material id or name>" }
- { "op": "setLighting", "timeOfDay": "day|sunset|night", "sunIntensity": 0-2, "ambientIntensity": 0.2-2, "interiorLightsOn": true|false }
- { "op": "setVisibility", "objectId": "<id>", "visible": true }
- { "op": "moveObject", "objectId": "<id>", "position": [x,y,z], "rotationYDeg": 0 }
- { "op": "scaleObject", "objectId": "<id>", "scale": 1.0 }
- { "op": "removeObject", "objectId": "<id>" }

BUILD (use these freely — you are expected to create new objects when asked):
- { "op": "addObject", "template": "<key>", "position": [x,y,z], "size": [w,h,d], "rotationYDeg": 0, "material": "<id/name>", "name": "..." }
- { "op": "addWall", "from": [x,z], "to": [x,z], "baseY": 0, "height": 3, "thickness": 0.24, "material": "paint-white" }
- { "op": "addRoom", "name": "Kitchen", "x": <center-x>, "z": <center-z>, "w": 4, "d": 3, "floorMaterial": "tile-porcelain" }
  (creates a named floor + perimeter walls with a door gap on the south edge)

OBJECT TEMPLATES for addObject:
${templateKeys().join(", ")}

RECIPES:
- Kitchen along a north wall: kitchen-counter runs (size ~[2.4,0.92,0.65]) side by side against the wall, stove and fridge in the run, upper-cabinet above at y≈1.55, kitchen-island ~1.5m in front.
- Second floor: addObject template "slab" size ≈ footprint of existing walls at position y = 3.35 (slab top ≈ 3.44), then addWall around the slab perimeter with baseY = 3.44 height 3, then a stairs object connecting levels inside.
- Bathroom: addRoom + bathtub/vanity inside; Bedroom: bed against wall + nightstands + wardrobe.

Respond with STRICT JSON only, no prose:
{
  "interpretation": "one sentence describing what you will do",
  "changes": [{ "label": "short area/system", "detail": "specific change" }],
  "operations": [ ...as documented above... ]
}

Rules:
- Only reference existing objectIds for modify ops; create new ones with build ops.
- Only use materials from the available list; templates have good defaults if material omitted.
- Do what the command implies fully: if asked to create/build/add a space or object, USE the build operations.
- For large designs output as many operations as needed (10–40 is fine).
- Avoid overlapping furniture; keep items within room bounds. Floor top is y=0.`;
}

/* ---------- whole-design generation from a single prompt ---------- */

const FULL_DESIGN_RE =
  /(design|create|generate|build|make)\b[\w\s-]{0,40}\b(house|home|villa|apartment|flat|cottage|cabin|bungalow|duplex|penthouse|layout|floor\s?plan|residence|studio|space)\b/i;

export function isFullDesignRequest(command: string): boolean {
  return FULL_DESIGN_RE.test(command);
}

function layoutPrompt(command: string): string {
  return `You are Prebuild AI generating a COMPLETE architectural layout from scratch.

USER REQUEST: "${command}"

Design a realistic, well-proportioned building layout. Respond with STRICT JSON only:
{
  "interpretation": "one sentence describing the design",
  "changes": [{ "label": "Room name", "detail": "3.5×4.2m · wood floor" }],
  "layout": {
    "exteriorW": <meters>,
    "exteriorD": <meters>,
    "walls": [{ "x1": n, "z1": n, "x2": n, "z2": n }],
    "rooms": [{ "name": "Living Room", "x": n, "z": n, "w": n, "d": n }],
    "items": [{ "kind": "sofa|table|chair|bed|wardrobe|plant|lamp|counter", "x": n, "z": n, "w": n, "d": n, "rotDeg": 0 }]
  }
}

COORDINATES: origin at the CENTER of the building footprint. +X east/right, +Z south/down. All meters.
RULES:
- walls use CENTERLINES; include the exterior envelope first, then interior partitions; leave ~0.9m gaps for door openings between rooms.
- rooms: x,z are the ROOM CENTER with width w and depth d; rooms must tile the interior without big gaps.
- items: place furniture INSIDE the matching room (bed in bedrooms, sofa/table in living, counters along a kitchen wall); max 16 items.
- Realistic sizes: bedroom ≥ 3×3.2m, living ≥ 4×4.5m, bed 1.8×2.1m, sofa 2.2×0.9m.`;
}

function planToProposal(
  command: string,
  interpretation: string,
  plan: LayoutPlan,
): SceneProposal {
  return {
    id: crypto.randomUUID(),
    command,
    interpretation,
    changes: [
      ...plan.rooms.map((r) => ({
        label: r.name,
        detail: `${r.w.toFixed(1)}×${r.d.toFixed(1)}m`,
      })),
      ...(plan.items.length
        ? [{ label: "Furniture", detail: `${plan.items.length} pieces placed` }]
        : []),
    ],
    source: PROVIDER_META[resolveActive().provider].short,
    apply: () => {
      const objects = buildSceneFromPlan(plan);
      useScene.setState((st) => ({
        past: [...st.past.slice(-49), { objects: st.objects, lighting: st.lighting, materialOverrides: st.materialOverrides }],
        future: [],
        objects: Object.fromEntries(objects.map((o) => [o.id, o])),
        selection: null,
        saveStatus: "unsaved",
      }));
      useScene.getState().touch();
      setTimeout(() => useVersions.getState().commit("AI generated design"), 60);
    },
  };
}

async function generateLayoutProposal(command: string): Promise<SceneProposal> {
  const raw = await llmJSON(layoutPrompt(command));
  const patch = raw as { layout?: unknown; interpretation?: string };
  const plan = normalizePlan(patch.layout);
  if (!plan.walls.length) throw new Error("EMPTY_LAYOUT");
  return planToProposal(
    command,
    patch.interpretation || `Generated a complete layout for “${command}”.`,
    plan,
  );
}

function variationsPrompt(): string {
  return `You are Prebuild AI, generating three distinct design variations of this living space.

${buildContext()}

Respond with STRICT JSON only:
{
  "variations": [
    {
      "title": "short style name",
      "description": "one sentence",
      "materials": ["human readable material names used"],
      "changes": [{ "label": "area", "detail": "change" }],
      "operations": [ ...same operation schema as before... ]
    }
  ]
}

Rules: exactly 3 variations with genuinely different material palettes and moods (e.g. Warm Modern / Minimal / Contemporary Indian unless the scene suggests better). Only valid objectIds and materials.`;
}

function parseOps(raw: unknown): SceneOp[] {
  if (!raw || typeof raw !== "object") return [];
  if (!Array.isArray((raw as { operations?: unknown }).operations)) return [];
  return (raw as { operations: SceneOp[] }).operations.filter(
    (o) => o && typeof o === "object" && typeof (o as SceneOp).op === "string",
  );
}

async function llmProposal(command: string): Promise<SceneProposal> {
  const { provider } = resolveActive();
  const compact = provider === "opencode" || provider === "claude-code";
  const raw = await llmJSON(systemPrompt(command, compact));
  const patch = raw as Partial<ScenePatch>;
  const ops = parseOps(patch);
  return {
    id: crypto.randomUUID(),
    command,
    interpretation: patch.interpretation || `Applied “${command}”.`,
    changes: Array.isArray(patch.changes) && patch.changes.length ? patch.changes : [],
    source: PROVIDER_META[resolveActive().provider].short,
    apply: () => executeOps(ops),
  };
}

/* ---------- local fallback engine (no key / offline) ---------- */

function warmModernApply() {
  executeOps([
    { op: "setMaterial", objectId: "floor-main", material: "stone-travertine" },
    { op: "setMaterial", objectId: "wall-left", material: "paint-beige" },
    { op: "setMaterial", objectId: "sofa-lounge", material: "fabric-linen" },
    { op: "setMaterial", objectId: "coffee-table", material: "wood-walnut" },
    { op: "setMaterial", objectId: "rug-main", material: "fabric-linen" },
    { op: "setLighting", timeOfDay: "sunset", interiorLightsOn: true, sunIntensity: 1.15, ambientIntensity: 0.95 },
  ]);
}

function minimalApply() {
  executeOps([
    { op: "setMaterial", objectId: "floor-main", material: "concrete-polished" },
    { op: "setMaterial", objectId: "sofa-lounge", material: "fabric-cotton" },
    { op: "setMaterial", objectId: "chair-lounge", material: "fabric-linen" },
    { op: "setMaterial", objectId: "coffee-table", material: "wood-oak" },
    { op: "setLighting", timeOfDay: "day", interiorLightsOn: false, sunIntensity: 1, ambientIntensity: 1.05 },
  ]);
}

function contemporaryIndianApply() {
  executeOps([
    { op: "setMaterial", objectId: "floor-main", material: "stone-kota" },
    { op: "setMaterial", objectId: "door-entry", material: "wood-teak" },
    { op: "setMaterial", objectId: "console-tv", material: "wood-teak" },
    { op: "setMaterial", objectId: "chair-lounge", material: "fabric-velvet" },
    { op: "setLighting", timeOfDay: "sunset", interiorLightsOn: true, sunIntensity: 1.1, ambientIntensity: 0.95 },
  ]);
}

function sampleLayoutProposal(command: string): SceneProposal {
  return planToProposal(
    command,
    `Generated a starter 2-bedroom layout — refine it with follow-up commands.`,
    SAMPLE_PLAN,
  );
}

function localProposal(command: string): SceneProposal {
  const c = command.toLowerCase();

  const rules: { test: RegExp; make: () => { interpretation: string; changes: ChangeItem[]; ops: SceneOp[] } }[] = [
    {
      test: /\b(second floor|upper floor|storey|story|another level|floor above)\b/,
      make: () => ({
        interpretation: "Build out a second storey over the existing footprint.",
        changes: [
          { label: "Structure", detail: "slab added at first-floor level" },
          { label: "Walls", detail: "perimeter walls on the new level" },
          { label: "Staircase", detail: "connecting flight positioned inside" },
        ],
        ops: [
          { op: "addObject", template: "slab", position: [0, 3.35, 0], size: [12.5, 0.18, 8.5], material: "concrete-polished", name: "First Floor Slab" },
          { op: "addWall", from: [-5.9, -4], to: [5.9, -4], baseY: 3.44 },
          { op: "addWall", from: [5.9, -4], to: [5.9, 4], baseY: 3.44 },
          { op: "addWall", from: [5.9, 4], to: [-5.9, 4], baseY: 3.44 },
          { op: "addWall", from: [-5.9, 4], to: [-5.9, -4], baseY: 3.44 },
          { op: "addObject", template: "stairs", position: [-4.9, 0, -0.6], name: "Stair to First Floor" },
        ],
      }),
    },
    {
      test: /\bkitchen\b/,
      make: () => ({
        interpretation: "Fit a full kitchen run along the back wall with an island.",
        changes: [
          { label: "Kitchen", detail: "counters, stove and fridge against north wall" },
          { label: "Island", detail: "marble-topped island with pendants" },
        ],
        ops: [
          { op: "addObject", template: "kitchen-counter", position: [-4.75, 0, -3.68] },
          { op: "addObject", template: "kitchen-counter", position: [-2.35, 0, -3.68] },
          { op: "addObject", template: "stove", position: [-0.6, 0, -3.66] },
          { op: "addObject", template: "fridge", position: [0.6, 0, -3.62] },
          { op: "addObject", template: "upper-cabinet", position: [-4.75, 1.55, -3.85] },
          { op: "addObject", template: "upper-cabinet", position: [-2.35, 1.55, -3.85] },
          { op: "addObject", template: "kitchen-island", position: [-2.6, 0, -1.7] },
          { op: "addObject", template: "pendant", position: [-2.6, 2.95, -1.7] },
        ],
      }),
    },
    {
      test: /\b(night)\b/,
      make: () => ({
        interpretation: "Shift the scene to night with interior lights on.",
        changes: [{ label: "Lighting", detail: "night sky, moonlight balance" }],
        ops: [{ op: "setLighting", timeOfDay: "night", interiorLightsOn: true, sunIntensity: 0.9 }],
      }),
    },
    {
      test: /\b(sunset|golden hour|warm(er)? lighting|warmer)\b/,
      make: () => ({
        interpretation: "Warm up the scene with golden-hour light.",
        changes: [{ label: "Lighting", detail: "sunset sun position, 3200K" }],
        ops: [{ op: "setLighting", timeOfDay: "sunset", interiorLightsOn: true, sunIntensity: 1.15 }],
      }),
    },
    {
      test: /\b(oak|walnut|teak)\b.*\bfloor\b|\bfloor\b.*\b(oak|walnut|teak)\b/,
      make: () => ({
        interpretation: "Replace the flooring with timber.",
        changes: [{ label: "Flooring", detail: "wide plank boards" }],
        ops: [
          {
            op: "setMaterial",
            objectId: "floor-main",
            material: /oak/.test(c) ? "wood-oak" : /walnut/.test(c) ? "wood-walnut" : "wood-teak",
          },
        ],
      }),
    },
    {
      test: /\bkota\b/,
      make: () => ({
        interpretation: "Replace stone surfaces with Kota stone.",
        changes: [{ label: "Flooring", detail: "kota stone, honed" }],
        ops: [
          { op: "setMaterial", objectId: "floor-main", material: "stone-kota" },
          { op: "setMaterial", objectId: "side-table", material: "stone-kota" },
        ],
      }),
    },
    {
      test: /\bmarble\b/,
      make: () => ({
        interpretation: "Bring in Carrara marble on primary surfaces.",
        changes: [{ label: "Flooring", detail: "carrara marble, polished" }],
        ops: [
          { op: "setMaterial", objectId: "floor-main", material: "stone-marble" },
          { op: "setMaterial", objectId: "side-table", material: "stone-marble" },
        ],
      }),
    },
    {
      test: /\b(plant|greenery)\b/,
      make: () => ({
        interpretation: "Reveal greenery in the space.",
        changes: [{ label: "Plants", detail: "fiddle fig + ceramic pot shown" }],
        ops: [
          { op: "setVisibility", objectId: "plant-large", visible: true },
          { op: "setVisibility", objectId: "plant-pot", visible: true },
        ],
      }),
    },
    {
      test: /\b(luxur(y|ious)|premium|rich)\b/,
      make: () => ({
        interpretation: "Elevate the palette toward quiet luxury.",
        changes: [
          { label: "Flooring", detail: "carrara marble" },
          { label: "Upholstery", detail: "velvet accents" },
          { label: "Lighting", detail: "warm evening layers" },
        ],
        ops: [
          { op: "setMaterial", objectId: "floor-main", material: "stone-marble" },
          { op: "setMaterial", objectId: "sofa-lounge", material: "fabric-velvet" },
          { op: "setMaterial", objectId: "pendant-main", material: "metal-brass" },
          { op: "setLighting", timeOfDay: "sunset", interiorLightsOn: true, sunIntensity: 1.1 },
        ],
      }),
    },
    {
      test: /\b(minimal|minimalist|declutter|simple)\b/,
      make: () => ({
        interpretation: "Move toward a calm, minimal palette.",
        changes: [{ label: "Palette", detail: "concrete, gallery white, pale oak" }],
        ops: [
          { op: "setMaterial", objectId: "floor-main", material: "concrete-polished" },
          { op: "setMaterial", objectId: "coffee-table", material: "wood-oak" },
          { op: "setLighting", timeOfDay: "day", interiorLightsOn: false, ambientIntensity: 1.05 },
        ],
      }),
    },
    {
      test: /\b(indian|jaipur|heritage)\b/,
      make: () => ({
        interpretation: "Apply a contemporary Indian material story.",
        changes: [
          { label: "Flooring", detail: "kota stone" },
          { label: "Joinery", detail: "teak" },
          { label: "Textiles", detail: "deep velvet accents" },
        ],
        ops: contemporaryIndianOps(),
      }),
    },
    {
      test: /\b(day(light)?|bright)\b/,
      make: () => ({
        interpretation: "Return to bright daylight.",
        changes: [{ label: "Lighting", detail: "clear daylight, 5600K" }],
        ops: [{ op: "setLighting", timeOfDay: "day", interiorLightsOn: false, sunIntensity: 1, ambientIntensity: 1 }],
      }),
    },
  ];

  for (const r of rules) {
    if (r.test.test(c)) {
      const m = r.make();
      return {
        id: crypto.randomUUID(),
        command,
        interpretation: m.interpretation,
        changes: m.changes,
        source: "local",
        apply: () => executeOps(m.ops),
      };
    }
  }

  return {
    id: crypto.randomUUID(),
    command,
    interpretation: "Refine the living space toward a warmer modern feel.",
    changes: [
      { label: "Wall finish", detail: "warm beige" },
      { label: "Rug", detail: "natural linen" },
    ],
    source: "local",
    apply: () =>
      executeOps([
        { op: "setMaterial", objectId: "wall-left", material: "paint-beige" },
        { op: "setMaterial", objectId: "rug-main", material: "fabric-linen" },
        { op: "setLighting", ambientIntensity: 0.92 },
      ]),
  };
}

function contemporaryIndianOps(): SceneOp[] {
  return [
    { op: "setMaterial", objectId: "floor-main", material: "stone-kota" },
    { op: "setMaterial", objectId: "door-entry", material: "wood-teak" },
    { op: "setMaterial", objectId: "console-tv", material: "wood-teak" },
    { op: "setMaterial", objectId: "chair-lounge", material: "fabric-velvet" },
    { op: "setLighting", timeOfDay: "sunset", interiorLightsOn: true, sunIntensity: 1.1, ambientIntensity: 0.95 },
  ];
}

function localVariations(): Variation[] {
  const defs: { title: string; description: string; materials: string[]; apply: () => void }[] = [
    {
      title: "Warm Modern",
      description: "Travertine floors, linen upholstery, golden-hour light.",
      materials: ["Travertine", "Walnut", "Linen"],
      apply: warmModernApply,
    },
    {
      title: "Minimal",
      description: "Polished concrete, gallery white walls, daylight clarity.",
      materials: ["Polished Concrete", "Pale Oak", "Cotton"],
      apply: minimalApply,
    },
    {
      title: "Contemporary Indian",
      description: "Kota stone, teak joinery, velvet accents at dusk.",
      materials: ["Kota Stone", "Teak", "Velvet"],
      apply: contemporaryIndianApply,
    },
  ];
  return defs.map((d, i) => ({ ...d, id: crypto.randomUUID(), index: i + 1 }));
}

async function llmVariations(): Promise<Variation[]> {
  interface RawVariation {
    title?: string;
    description?: string;
    materials?: string[];
    changes?: ChangeItem[];
    operations?: SceneOp[];
  }
  const raw = (await llmJSON(variationsPrompt())) as { variations?: RawVariation[] };
  const list = Array.isArray(raw.variations) ? raw.variations.slice(0, 3) : [];

  return list.map((v, i) => {
    const ops = parseOps(v);
    return {
      id: crypto.randomUUID(),
      index: i + 1,
      title: v.title?.trim() || `Variation ${i + 1}`,
      description: v.description?.trim() || "",
      materials: Array.isArray(v.materials) ? v.materials.slice(0, 4).map(String) : [],
      apply: () => executeOps(ops),
    };
  });
}

/* ---------- store ---------- */

interface AIStore {
  status: "idle" | "thinking";
  engineLabel: string;
  error: string | null;
  proposal: SceneProposal | null;
  applied: boolean;
  variations: Variation[];
  history: HistoryEntry[];
  submit: (command: string) => void;
  applyProposal: () => void;
  discardProposal: () => void;
}

let entryCounter = 0;
let requestSeq = 0;

export const useAI = create<AIStore>((set, get) => ({
  status: "idle",
  engineLabel: PROVIDER_META[resolveActive().provider].short,
  error: null,
  proposal: null,
  applied: false,
  variations: localVariations(),
  history: [],

  submit: (command) => {
    if (!command.trim()) return;
    const seq = ++requestSeq;
    const { provider, ready } = resolveActive();
    const useLLM = provider !== "local" && ready;
    const label = PROVIDER_META[useLLM ? provider : "local"].short;

    set({ status: "thinking", proposal: null, applied: false, error: null, engineLabel: label });

    const finishThinking = () => {
      if (seq === requestSeq) set({ status: "idle" });
    };
    const stale = () => seq !== requestSeq;

    // Whole-design generation
    if (isFullDesignRequest(command)) {
      const run = useLLM ? generateLayoutProposal(command).catch(() => null) : Promise.resolve(null);
      run.then((proposal) => {
        finishThinking();
        if (stale()) return;
        if (useLLM && !proposal) set({ error: `${label} couldn't generate a layout — showing a sample design.` });
        set({ proposal: proposal ?? sampleLayoutProposal(command), applied: false });
      });
      return;
    }

    // Variations request
    if (/(variation|version|option)s?\b/i.test(command)) {
      const run = useLLM ? llmVariations().catch(() => null) : Promise.resolve(null);
      run.then((vars) => {
        finishThinking();
        if (stale()) return;
        if (vars && vars.length >= 2) {
          set({ variations: vars });
        } else {
          set({ variations: localVariations() });
          if (seq === requestSeq && useLLM)
            set({ error: `${label} couldn't generate variations — showing local presets.` });
        }
        window.dispatchEvent(new CustomEvent("prebuild:variations"));
      });
      return;
    }

    const run: Promise<SceneProposal> = useLLM
      ? llmProposal(command).catch((err) => {
          if (seq === requestSeq) {
            const reason = err instanceof Error ? err.message.slice(0, 90) : "unknown error";
            set({ error: `${label} failed — ${reason}. Used the built-in rules engine instead.` });
          }
          return localProposal(command);
        })
      : Promise.resolve(localProposal(command));

    run.then((proposal) => {
      finishThinking();
      if (stale()) return;
      set({ proposal, applied: false });
    });
  },

  applyProposal: () => {
    const { proposal, applied } = get();
    if (!proposal || applied) return;
    proposal.apply();
    const entry: HistoryEntry = {
      id: ++entryCounter,
      command: proposal.command,
      changes: proposal.changes,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: proposal.source,
    };
    set((s) => ({ applied: true, proposal: null, history: [entry, ...s.history].slice(0, 20) }));
  },

  discardProposal: () => set({ proposal: null, applied: false }),
}));
