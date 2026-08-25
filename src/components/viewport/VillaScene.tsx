import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Edges, TransformControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useScene, type Selection } from "../../store/scene";
import { useUI } from "../../store/ui";
import { getMaterial } from "../../data/materials";
import { getThreeTexture } from "../../lib/textures";
import type { Part, SceneObject } from "../../types";

export const objectRegistry = new Map<string, THREE.Object3D>();

/** Live orbit-target position — manual additions spawn here. */
export const spawnPoint = { x: 0, y: 0, z: 0 };

function SpawnTracker() {
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null;
  useFrame(() => {
    if (controls?.target) {
      spawnPoint.x = controls.target.x;
      spawnPoint.y = controls.target.y;
      spawnPoint.z = controls.target.z;
    }
  });
  return null;
}

const ACCENT = new THREE.Color("#d9a441");

function PartGeometry({ geo }: { geo: Part["geo"] }) {
  switch (geo.kind) {
    case "box":
      return <boxGeometry args={geo.size} />;
    case "cylinder":
      return <cylinderGeometry args={[geo.radius, geo.radius, geo.height, 28]} />;
    case "sphere":
      return <sphereGeometry args={[geo.radius, 24, 18]} />;
    case "cone":
      return <coneGeometry args={[geo.radius, geo.height, 28]} />;
  }
}

interface MaterialTargets {
  color: THREE.Color;
  roughness: number;
  metalness: number;
  opacity: number;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

function PartMesh({
  obj,
  part,
  selected,
  lightsOn,
}: {
  obj: SceneObject;
  part: Part;
  selected: boolean;
  lightsOn: boolean;
}) {
  const overrides = useScene((s) => s.materialOverrides);
  const base = getMaterial(part.materialId ?? obj.materialId);
  const ov = overrides[base.id];
  const def = { ...base, ...ov };

  const repeat = useMemo(() => {
    if (part.geo.kind !== "box") return 2;
    const max = Math.max(...part.geo.size);
    return Math.min(6, Math.max(1, Math.round(max / 1.6)));
  }, [part.geo]);

  // Texture swaps are discrete (no crossfade possible on a single material);
  // everything numeric animates smoothly via useFrame below.
  const map = useMemo(
    () => getThreeTexture(def.texture, part.color ?? def.color, repeat),
    [def.texture, def.color, part.color, repeat],
  );

  const targets = useMemo<MaterialTargets>(() => {
    const isLight = part.emissiveIntensity !== undefined;
    return {
      color: new THREE.Color(part.color ?? def.color),
      roughness: part.roughness ?? def.roughness,
      metalness: part.metalness ?? def.metalness,
      opacity: part.opacity ?? def.opacity,
      emissive: isLight
        ? new THREE.Color(part.color ?? "#ffd9a0")
        : selected
          ? ACCENT
          : new THREE.Color("#000000"),
      emissiveIntensity: isLight
        ? lightsOn
          ? (part.emissiveIntensity ?? 2)
          : 0.05
        : selected
          ? 0.22
          : 0,
    };
  }, [def.color, def.roughness, def.metalness, def.opacity, part, selected, lightsOn]);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  // Snap values on first mount so initial render is exact.
  useEffect(() => {
    const m = matRef.current;
    if (!m || m.userData.snapped) return;
    m.userData.snapped = true;
    m.color.copy(targets.color);
    m.roughness = targets.roughness;
    m.metalness = targets.metalness;
    m.opacity = targets.opacity;
    m.emissive.copy(targets.emissive);
    m.emissiveIntensity = targets.emissiveIntensity;
  });

  // Texture changes can't interpolate — swap immediately.
  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    if (m.map !== (map ?? null)) {
      m.map = map ?? null;
      m.needsUpdate = true;
    }
  }, [map]);

  useFrame((_, dt) => {
    const m = matRef.current;
    if (!m) return;
    const k = 1 - Math.exp(-9 * Math.min(dt, 0.1));
    m.color.lerp(targets.color, k);
    m.roughness += (targets.roughness - m.roughness) * k;
    m.metalness += (targets.metalness - m.metalness) * k;
    m.opacity += (targets.opacity - m.opacity) * k;
    m.emissive.lerp(targets.emissive, k);
    m.emissiveIntensity += (targets.emissiveIntensity - m.emissiveIntensity) * k;
  });

  const opacity = part.opacity ?? def.opacity;

  return (
    <mesh
      position={part.offset ?? [0, 0, 0]}
      castShadow={obj.castShadow && opacity > 0.5}
      receiveShadow={obj.receiveShadow}
    >
      <PartGeometry geo={part.geo} />
      <meshStandardMaterial ref={matRef} transparent={opacity < 1} depthWrite={opacity >= 0.5} />
      {selected && <Edges threshold={20} color="#d9a441" transparent opacity={0.9} />}
    </mesh>
  );
}

function SceneNode({ obj }: { obj: SceneObject }) {
  const select = useScene((s) => s.select);
  const selection = useScene((s) => s.selection);
  const interiorLightsOn = useScene((s) => s.lighting.interiorLightsOn);
  const selected = selection?.kind === "object" && selection.id === obj.id;

  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    if (ref.current) objectRegistry.set(obj.id, ref.current);
    return () => {
      objectRegistry.delete(obj.id);
    };
  }, [obj.id, obj.visible]);

  if (!obj.visible) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ kind: "object", id: obj.id });
  };

  return (
    <group
      ref={ref}
      position={obj.position}
      rotation={[0, obj.rotationY, 0]}
      scale={obj.scale}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {obj.parts.map((p, i) => (
        <PartMesh key={i} obj={obj} part={p} selected={selected} lightsOn={interiorLightsOn} />
      ))}
    </group>
  );
}

function SceneNodes() {
  const objects = useScene((s) => s.objects);
  return (
    <>
      {Object.values(objects).map((o) => (
        <SceneNode key={o.id} obj={o} />
      ))}
    </>
  );
}

function Gizmo() {
  const selection = useScene((s) => s.selection) as Selection;
  const mode = useUI((s) => s.transformMode);
  const presenting = useUI((s) => s.presenting);
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const beforeRef = useRef<Record<string, SceneObject> | null>(null);
  const changedRef = useRef(false);

  const id = selection?.kind === "object" ? selection.id : null;

  useEffect(() => {
    setTarget(id ? objectRegistry.get(id) ?? null : null);
  }, [id]);

  if (!target || !id || presenting) return null;

  return (
    <TransformControls
      object={target}
      mode={mode}
      size={0.75}
      showY={mode === "rotate" ? false : undefined}
      showZ={mode === "rotate" ? false : undefined}
      onMouseDown={() => {
        beforeRef.current = structuredClone(useScene.getState().objects);
        changedRef.current = false;
      }}
      onObjectChange={() => {
        changedRef.current = true;
        useScene.getState().updateObject(
          id,
          {
            position: [target.position.x, target.position.y, target.position.z],
            rotationY: target.rotation.y,
            scale: [target.scale.x, target.scale.y, target.scale.z],
          },
          { history: false },
        );
      }}
      onMouseUp={() => {
        if (beforeRef.current && changedRef.current) {
          const before = beforeRef.current;
          useScene.setState((s) => ({
            past: [
              ...s.past.slice(-49),
              { objects: before, lighting: s.lighting, materialOverrides: s.materialOverrides },
            ],
            future: [],
          }));
          beforeRef.current = null;
          useScene.getState().touch();
        }
      }}
    />
  );
}

export { SceneNodes, Gizmo, SpawnTracker };
