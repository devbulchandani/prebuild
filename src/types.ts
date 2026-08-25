export type Vec3 = [number, number, number];

export type PartGeo =
  | { kind: "box"; size: Vec3 }
  | { kind: "cylinder"; radius: number; height: number }
  | { kind: "sphere"; radius: number }
  | { kind: "cone"; radius: number; height: number };

export interface Part {
  geo: PartGeo;
  offset?: Vec3;
  materialId?: string;
  color?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  emissiveIntensity?: number;
}

export type ObjectCategory =
  | "floors"
  | "walls"
  | "ceilings"
  | "doors"
  | "windows"
  | "stairs"
  | "columns"
  | "furniture"
  | "fixtures"
  | "plants"
  | "decor";

export interface SceneObject {
  id: string;
  name: string;
  category: ObjectCategory;
  position: Vec3;
  rotationY: number;
  scale: Vec3;
  visible: boolean;
  materialId: string;
  parts: Part[];
  castShadow: boolean;
  receiveShadow: boolean;
}

export type TimeOfDay = "day" | "sunset" | "night";

export interface LightingState {
  timeOfDay: TimeOfDay;
  sunIntensity: number;
  ambientIntensity: number;
  interiorLightsOn: boolean;
}

export type MaterialCategory =
  | "Stone"
  | "Wood"
  | "Concrete"
  | "Metal"
  | "Glass"
  | "Paint"
  | "Tile"
  | "Fabric";

export type TextureKind =
  | "plain"
  | "marble"
  | "travertine"
  | "wood"
  | "concrete"
  | "brushed"
  | "glass"
  | "tile"
  | "terrazzo"
  | "fabric"
  | "velvet";

export interface MaterialDef {
  id: string;
  name: string;
  category: MaterialCategory;
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  texture: TextureKind;
}
