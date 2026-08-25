import type { ObjectCategory, Part, SceneObject, Vec3 } from "../types";

export interface TemplateDef {
  category: ObjectCategory;
  materialId: string;
  defaultSize: [number, number, number]; // w, h, d
  /** parts are built at origin, y=0 is the object's base unless noted */
  build: (w: number, h: number, d: number) => Part[];
}

const M = (id: string) => id;

export const TEMPLATES: Record<string, TemplateDef> = {
  /* ---------- seating & tables ---------- */
  sofa: {
    category: "furniture",
    materialId: "fabric-linen",
    defaultSize: [2.4, 0.85, 1],
    build: (w, _h, d) => [
      { geo: { kind: "box", size: [w, 0.38, d] }, offset: [0, 0.19, 0] },
      { geo: { kind: "box", size: [w, 0.55, 0.22] }, offset: [0, 0.62, d / 2 - 0.11] },
      { geo: { kind: "box", size: [0.22, 0.52, d] }, offset: [-w / 2 + 0.11, 0.45, 0] },
      { geo: { kind: "box", size: [0.22, 0.52, d] }, offset: [w / 2 - 0.11, 0.45, 0] },
    ],
  },
  armchair: {
    category: "furniture",
    materialId: "fabric-velvet",
    defaultSize: [0.9, 0.8, 0.9],
    build: (w) => [
      { geo: { kind: "box", size: [w, 0.35, w] }, offset: [0, 0.3, 0] },
      { geo: { kind: "box", size: [w, 0.5, 0.18] }, offset: [0, 0.6, w / 2 - 0.09] },
      { geo: { kind: "box", size: [0.16, 0.42, w] }, offset: [-w / 2 + 0.08, 0.52, 0] },
      { geo: { kind: "box", size: [0.16, 0.42, w] }, offset: [w / 2 - 0.08, 0.52, 0] },
    ],
  },
  "coffee-table": {
    category: "furniture",
    materialId: "wood-walnut",
    defaultSize: [1.3, 0.42, 0.7],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, 0.06, d] }, offset: [0, h - 0.08, 0] },
      { geo: { kind: "box", size: [0.06, h - 0.11, 0.06] }, offset: [-w / 2 + 0.07, (h - 0.11) / 2, -d / 2 + 0.07], materialId: M("metal-black") },
      { geo: { kind: "box", size: [0.06, h - 0.11, 0.06] }, offset: [w / 2 - 0.07, (h - 0.11) / 2, -d / 2 + 0.07], materialId: M("metal-black") },
      { geo: { kind: "box", size: [0.06, h - 0.11, 0.06] }, offset: [-w / 2 + 0.07, (h - 0.11) / 2, d / 2 - 0.07], materialId: M("metal-black") },
      { geo: { kind: "box", size: [0.06, h - 0.11, 0.06] }, offset: [w / 2 - 0.07, (h - 0.11) / 2, d / 2 - 0.07], materialId: M("metal-black") },
    ],
  },
  "dining-table": {
    category: "furniture",
    materialId: "wood-oak",
    defaultSize: [1.8, 0.76, 0.95],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, 0.05, d] }, offset: [0, h - 0.03, 0] },
      ...([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => ({
        geo: { kind: "box" as const, size: [0.09, h - 0.05, 0.09] as [number, number, number] },
        offset: [sx * (w / 2 - 0.12), (h - 0.05) / 2, sz * (d / 2 - 0.12)] as Vec3,
        color: "#26262a" as string,
      })),
    ],
  },
  chair: {
    category: "furniture",
    materialId: "fabric-velvet",
    defaultSize: [0.55, 0.9, 0.55],
    build: (w) => [
      { geo: { kind: "box", size: [w, 0.1, w] }, offset: [0, 0.45, 0] },
      { geo: { kind: "box", size: [w, 0.45, 0.08] }, offset: [0, 0.68, w / 2 - 0.04] },
      ...([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => ({
        geo: { kind: "box" as const, size: [0.05, 0.44, 0.05] as [number, number, number] },
        offset: [sx * (w / 2 - 0.05), 0.22, sz * (w / 2 - 0.05)] as Vec3,
        color: "#26262a" as string,
      })),
    ],
  },

  /* ---------- bedroom ---------- */
  bed: {
    category: "furniture",
    materialId: "fabric-cotton",
    defaultSize: [1.8, 0.6, 2.1],
    build: (w, _h, d) => [
      { geo: { kind: "box", size: [w, 0.25, d] }, offset: [0, 0.15, 0], materialId: M("wood-oak") },
      { geo: { kind: "box", size: [w - 0.1, 0.24, d - 0.15] }, offset: [0, 0.39, 0.02], materialId: M("fabric-linen") },
      { geo: { kind: "box", size: [w, 0.9, 0.1] }, offset: [0, 0.55, -d / 2 + 0.05], materialId: M("wood-walnut") },
      { geo: { kind: "box", size: [w * 0.36, 0.12, 0.34] }, offset: [-w * 0.21, 0.56, -d * 0.32], materialId: M("paint-white") },
      { geo: { kind: "box", size: [w * 0.36, 0.12, 0.34] }, offset: [w * 0.21, 0.56, -d * 0.32], materialId: M("paint-white") },
    ],
  },
  wardrobe: {
    category: "furniture",
    materialId: "wood-teak",
    defaultSize: [1.8, 2.2, 0.65],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h, d] }, offset: [0, h / 2, 0] },
      { geo: { kind: "box", size: [0.03, 0.28, 0.03] }, offset: [-0.15, h * 0.52, d / 2 + 0.02], materialId: M("metal-brass") },
      { geo: { kind: "box", size: [0.03, 0.28, 0.03] }, offset: [0.15, h * 0.52, d / 2 + 0.02], materialId: M("metal-brass") },
    ],
  },
  nightstand: {
    category: "furniture",
    materialId: "wood-walnut",
    defaultSize: [0.5, 0.55, 0.45],
    build: (w, h, d) => [{ geo: { kind: "box", size: [w, h, d] }, offset: [0, h / 2, 0] }],
  },
  bookshelf: {
    category: "furniture",
    materialId: "wood-oak",
    defaultSize: [1.2, 1.9, 0.35],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, 0.04, d] }, offset: [0, 0.02, 0] },
      { geo: { kind: "box", size: [w, 0.04, d] }, offset: [0, h * 0.33, 0] },
      { geo: { kind: "box", size: [w, 0.04, d] }, offset: [0, h * 0.66, 0] },
      { geo: { kind: "box", size: [w, 0.04, d] }, offset: [0, h, 0] },
      { geo: { kind: "box", size: [0.04, h, d] }, offset: [-w / 2 + 0.02, h / 2, 0] },
      { geo: { kind: "box", size: [0.04, h, d] }, offset: [w / 2 - 0.02, h / 2, 0] },
      { geo: { kind: "box", size: [0.04, h, d] }, offset: [0, h / 2, -d / 2 + 0.02] },
      { geo: { kind: "box", size: [w * 0.3, h * 0.2, d * 0.6] }, offset: [-w * 0.2, h * 0.43, 0.02], materialId: M("stone-travertine") },
      { geo: { kind: "box", size: [w * 0.25, h * 0.16, d * 0.6] }, offset: [w * 0.22, h * 0.76, 0.02], materialId: M("paint-charcoal") },
    ],
  },

  /* ---------- decor, plants, lighting ---------- */
  rug: {
    category: "decor",
    materialId: "fabric-velvet",
    defaultSize: [3, 0.03, 2],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h, d] }, offset: [0, 0, 0] },
      { geo: { kind: "box", size: [w * 0.88, h + 0.004, d * 0.86] }, offset: [0, 0.002, 0], materialId: M("fabric-cotton") },
    ],
  },
  plant: {
    category: "plants",
    materialId: "concrete-textured",
    defaultSize: [0.9, 1.9, 0.9],
    build: () => [
      { geo: { kind: "cylinder", radius: 0.24, height: 0.42 }, offset: [0, 0.21, 0] },
      { geo: { kind: "cylinder", radius: 0.03, height: 1.1 }, offset: [0, 0.95, 0], color: "#5a4632", roughness: 0.9 },
      { geo: { kind: "sphere", radius: 0.42 }, offset: [0.05, 1.72, 0], color: "#4a6b45", roughness: 0.85 },
      { geo: { kind: "sphere", radius: 0.28 }, offset: [-0.27, 1.42, 0.12], color: "#55764e", roughness: 0.85 },
      { geo: { kind: "sphere", radius: 0.24 }, offset: [0.3, 1.38, -0.14], color: "#40603c", roughness: 0.85 },
    ],
  },
  "floor-lamp": {
    category: "fixtures",
    materialId: "metal-brass",
    defaultSize: [0.4, 1.75, 0.4],
    build: () => [
      { geo: { kind: "cylinder", radius: 0.16, height: 0.03 }, offset: [0, 0.015, 0] },
      { geo: { kind: "cylinder", radius: 0.02, height: 1.6 }, offset: [0, 0.8, 0] },
      { geo: { kind: "cone", radius: 0.19, height: 0.26 }, offset: [0, 1.66, 0] },
      { geo: { kind: "sphere", radius: 0.06 }, offset: [0, 1.58, 0], color: "#ffe2b0", emissiveIntensity: 2.2 },
    ],
  },
  pendant: {
    category: "fixtures",
    materialId: "metal-black",
    defaultSize: [0.55, 1.1, 0.55],
    /** hangs from its position.y downward — set position y ≈ ceiling height */
    build: () => [
      { geo: { kind: "cylinder", radius: 0.01, height: 0.8 }, offset: [0, 0.4, 0] },
      { geo: { kind: "cone", radius: 0.26, height: 0.3 }, offset: [0, -0.12, 0] },
      { geo: { kind: "sphere", radius: 0.07 }, offset: [0, -0.24, 0], color: "#ffd9a0", emissiveIntensity: 2.4 },
    ],
  },
  column: {
    category: "columns",
    materialId: "concrete-polished",
    defaultSize: [0.45, 3.2, 0.45],
    build: (_w, h) => [
      { geo: { kind: "cylinder", radius: 0.21, height: h } },
      { geo: { kind: "cylinder", radius: 0.27, height: 0.12 }, offset: [0, -(h / 2) + 0.06, 0] },
    ],
  },

  /* ---------- kitchen ---------- */
  "kitchen-counter": {
    category: "furniture",
    materialId: "concrete-polished",
    defaultSize: [2.4, 0.92, 0.65],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h - 0.06, d] }, offset: [0, (h - 0.06) / 2, 0] },
      { geo: { kind: "box", size: [w + 0.05, 0.06, d + 0.05] }, offset: [0, h - 0.03, 0], materialId: M("stone-marble") },
      { geo: { kind: "box", size: [w - 0.14, 0.02, 0.02] }, offset: [0, h * 0.62, d / 2 + 0.01], materialId: M("metal-black") },
    ],
  },
  "upper-cabinet": {
    category: "furniture",
    materialId: "paint-charcoal",
    defaultSize: [1.6, 0.7, 0.38],
    /** wall-hung: give it a position with y ≈ 1.5 */
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h, d] } },
      { geo: { kind: "box", size: [w - 0.16, 0.02, 0.02] }, offset: [0, 0, d / 2 + 0.01], materialId: M("metal-brass") },
    ],
  },
  "kitchen-island": {
    category: "furniture",
    materialId: "stone-marble",
    defaultSize: [2, 0.95, 1],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w - 0.1, h - 0.08, d - 0.1] }, offset: [0, (h - 0.08) / 2, 0], materialId: M("paint-charcoal") },
      { geo: { kind: "box", size: [w, 0.08, d] }, offset: [0, h - 0.04, 0] },
    ],
  },
  fridge: {
    category: "fixtures",
    materialId: "metal-steel",
    defaultSize: [0.85, 1.9, 0.72],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h, d] }, offset: [0, h / 2, 0] },
      { geo: { kind: "box", size: [0.03, h * 0.32, 0.03] }, offset: [w / 2 - 0.08, h * 0.58, d / 2 + 0.02], color: "#e5e2da" },
      { geo: { kind: "box", size: [w, 0.015, d] }, offset: [0, h * 0.66, 0], color: "#3a3936" },
    ],
  },
  stove: {
    category: "fixtures",
    materialId: "metal-steel",
    defaultSize: [0.75, 0.92, 0.65],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h - 0.04, d] }, offset: [0, (h - 0.04) / 2, 0] },
      { geo: { kind: "box", size: [w - 0.12, 0.02, d - 0.12] }, offset: [0, h - 0.05, 0], color: "#1d1d20" },
      ...([-1, 1] as const).flatMap((sx) =>
        [-1, 1].map((sz) => ({
          geo: { kind: "cylinder" as const, radius: 0.09, height: 0.015 },
          offset: [sx * 0.17, h - 0.035, sz * 0.15] as Vec3,
          color: "#111114",
        })),
      ),
    ],
  },

  /* ---------- bathroom ---------- */
  bathtub: {
    category: "fixtures",
    materialId: "tile-ceramic",
    defaultSize: [1.75, 0.6, 0.8],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h, d] }, offset: [0, h / 2, 0] },
      { geo: { kind: "box", size: [w - 0.24, h - 0.18, d - 0.24] }, offset: [0, h / 2 + 0.04, 0], materialId: M("glass-tinted"), opacity: 0.9 },
    ],
  },
  vanity: {
    category: "fixtures",
    materialId: "wood-walnut",
    defaultSize: [1.1, 0.85, 0.55],
    build: (w, h, d) => [
      { geo: { kind: "box", size: [w, h - 0.08, d] }, offset: [0, (h - 0.08) / 2, 0] },
      { geo: { kind: "box", size: [w + 0.04, 0.08, d + 0.04] }, offset: [0, h - 0.04, 0], materialId: M("stone-marble") },
      { geo: { kind: "cylinder", radius: 0.02, height: 0.28 }, offset: [0, h + 0.1, -d / 2 + 0.08], materialId: M("metal-brass") },
    ],
  },

  /* ---------- structure ---------- */
  slab: {
    category: "floors",
    materialId: "concrete-polished",
    defaultSize: [12, 0.18, 8],
    build: (w, h, d) => [{ geo: { kind: "box", size: [w, h, d] } }],
  },
  partition: {
    category: "walls",
    materialId: "paint-white",
    defaultSize: [3, 3, 0.24],
    build: (w, h, d) => [{ geo: { kind: "box", size: [w, h, d] } }],
  },
  stairs: {
    category: "stairs",
    materialId: "wood-oak",
    defaultSize: [1.25, 2.9, 4.4],
    /** rises along -z; place near a wall */
    build: (w, h, d) => {
      const steps = Math.max(8, Math.round(h / 0.19));
      return Array.from({ length: steps }, (_, i) => ({
        geo: { kind: "box" as const, size: [w, 0.13, d / steps] as [number, number, number] },
        offset: [0, ((i + 0.5) * h) / steps, d / 2 - ((i + 0.5) * d) / steps] as Vec3,
      }));
    },
  },
};

export function templateKeys(): string[] {
  return Object.keys(TEMPLATES);
}

let uidCounter = 0;
export function nextTemplateId(template: string): string {
  return `ai-${template}-${++uidCounter}`;
}

/** Build a ready-to-insert SceneObject from a template at a world position. */
export function createTemplateObject(
  templateKey: string,
  position: Vec3,
  opts?: { size?: Vec3; rotationYDeg?: number; materialId?: string; name?: string },
): SceneObject | null {
  const def = TEMPLATES[templateKey.toLowerCase()];
  if (!def) return null;
  const [dw, dh, dd] = def.defaultSize;
  const w = opts?.size?.[0] ?? dw;
  const h = opts?.size?.[1] ?? dh;
  const d = opts?.size?.[2] ?? dd;
  const id = nextTemplateId(templateKey.toLowerCase());
  const name =
    (opts?.name || "").trim() ||
    templateKey
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  return {
    id,
    name,
    category: def.category,
    position,
    rotationY: ((opts?.rotationYDeg ?? 0) * Math.PI) / 180,
    scale: [1, 1, 1],
    visible: true,
    materialId: opts?.materialId ?? def.materialId,
    parts: def.build(w, h, d),
    castShadow: true,
    receiveShadow: true,
  };
}

/** Suggested insertion height for wall-hung / hanging templates. */
export const TEMPLATE_SPAWN_Y: Record<string, number> = {
  pendant: 2.95,
  "upper-cabinet": 1.55,
};
