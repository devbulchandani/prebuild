import type { MaterialDef } from "../types";

export const MATERIALS: MaterialDef[] = [
  // STONE
  { id: "stone-marble", name: "Carrara Marble", category: "Stone", color: "#e8e6e1", roughness: 0.18, metalness: 0.02, opacity: 1, texture: "marble" },
  { id: "stone-travertine", name: "Travertine", category: "Stone", color: "#d6c6ad", roughness: 0.55, metalness: 0.0, opacity: 1, texture: "travertine" },
  { id: "stone-kota", name: "Kota Stone", category: "Stone", color: "#9aa08f", roughness: 0.62, metalness: 0.0, opacity: 1, texture: "concrete" },
  { id: "stone-sandstone", name: "Sandstone", category: "Stone", color: "#c8a878", roughness: 0.7, metalness: 0.0, opacity: 1, texture: "travertine" },
  // WOOD
  { id: "wood-oak", name: "Light Oak", category: "Wood", color: "#b8926a", roughness: 0.5, metalness: 0.0, opacity: 1, texture: "wood" },
  { id: "wood-walnut", name: "Walnut", category: "Wood", color: "#5e4433", roughness: 0.42, metalness: 0.0, opacity: 1, texture: "wood" },
  { id: "wood-teak", name: "Teak", category: "Wood", color: "#8a5a33", roughness: 0.48, metalness: 0.0, opacity: 1, texture: "wood" },
  // CONCRETE
  { id: "concrete-raw", name: "Raw Concrete", category: "Concrete", color: "#8d8d89", roughness: 0.85, metalness: 0.0, opacity: 1, texture: "concrete" },
  { id: "concrete-polished", name: "Polished Concrete", category: "Concrete", color: "#a3a29d", roughness: 0.28, metalness: 0.05, opacity: 1, texture: "concrete" },
  { id: "concrete-textured", name: "Textured Concrete", category: "Concrete", color: "#77756f", roughness: 0.95, metalness: 0.0, opacity: 1, texture: "concrete" },
  // METAL
  { id: "metal-brass", name: "Brass", category: "Metal", color: "#b98a44", roughness: 0.32, metalness: 0.92, opacity: 1, texture: "brushed" },
  { id: "metal-steel", name: "Steel", category: "Metal", color: "#a9adb2", roughness: 0.28, metalness: 0.95, opacity: 1, texture: "brushed" },
  { id: "metal-black", name: "Black Metal", category: "Metal", color: "#26262a", roughness: 0.45, metalness: 0.8, opacity: 1, texture: "brushed" },
  // GLASS
  { id: "glass-clear", name: "Clear Glass", category: "Glass", color: "#cfe0e4", roughness: 0.05, metalness: 0.1, opacity: 0.18, texture: "glass" },
  { id: "glass-frosted", name: "Frosted Glass", category: "Glass", color: "#d8e2e4", roughness: 0.6, metalness: 0.0, opacity: 0.5, texture: "glass" },
  { id: "glass-tinted", name: "Tinted Glass", category: "Glass", color: "#7a6a52", roughness: 0.1, metalness: 0.15, opacity: 0.35, texture: "glass" },
  // PAINT
  { id: "paint-white", name: "Gallery White", category: "Paint", color: "#eceae4", roughness: 0.85, metalness: 0.0, opacity: 1, texture: "plain" },
  { id: "paint-beige", name: "Warm Beige", category: "Paint", color: "#ddd0ba", roughness: 0.85, metalness: 0.0, opacity: 1, texture: "plain" },
  { id: "paint-grey", name: "Stone Grey", category: "Paint", color: "#b3b2ac", roughness: 0.85, metalness: 0.0, opacity: 1, texture: "plain" },
  { id: "paint-charcoal", name: "Charcoal", category: "Paint", color: "#3a3936", roughness: 0.88, metalness: 0.0, opacity: 1, texture: "plain" },
  // TILE
  { id: "tile-ceramic", name: "Ceramic White", category: "Tile", color: "#e5e2da", roughness: 0.2, metalness: 0.0, opacity: 1, texture: "tile" },
  { id: "tile-porcelain", name: "Porcelain Grey", category: "Tile", color: "#c4c2bb", roughness: 0.25, metalness: 0.0, opacity: 1, texture: "tile" },
  { id: "tile-terrazzo", name: "Terrazzo", category: "Tile", color: "#ded8cd", roughness: 0.35, metalness: 0.0, opacity: 1, texture: "terrazzo" },
  // FABRIC
  { id: "fabric-linen", name: "Linen", category: "Fabric", color: "#cfc6b6", roughness: 0.9, metalness: 0.0, opacity: 1, texture: "fabric" },
  { id: "fabric-velvet", name: "Velvet Forest", category: "Fabric", color: "#31513f", roughness: 0.75, metalness: 0.0, opacity: 1, texture: "velvet" },
  { id: "fabric-cotton", name: "Cotton Ivory", category: "Fabric", color: "#e3ddcf", roughness: 0.92, metalness: 0.0, opacity: 1, texture: "fabric" },
];

export const MATERIAL_CATEGORIES = [
  "Stone",
  "Wood",
  "Concrete",
  "Metal",
  "Glass",
  "Paint",
  "Tile",
  "Fabric",
] as const;

const materialMap = new Map(MATERIALS.map((m) => [m.id, m]));

export function getMaterial(id: string): MaterialDef {
  return materialMap.get(id) ?? MATERIALS[0];
}
