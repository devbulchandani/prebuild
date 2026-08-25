import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, Lightformer } from "@react-three/drei";
import { useScene } from "../../store/scene";
import { useUI } from "../../store/ui";
import type { TimeOfDay } from "../../types";
import { SceneNodes, Gizmo, SpawnTracker } from "./VillaScene";

interface Preset {
  bg: string;
  sunPos: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  groundColor: string;
}

const PRESETS: Record<TimeOfDay, Preset> = {
  day: {
    bg: "#b7c3cc",
    sunPos: [9, 14, 5],
    sunColor: "#fff1dc",
    sunIntensity: 2.6,
    hemiSky: "#cfdde8",
    hemiGround: "#8a8074",
    hemiIntensity: 0.55,
    groundColor: "#a9b2b6",
  },
  sunset: {
    bg: "#c39a72",
    sunPos: [-12, 2.8, -5],
    sunColor: "#ff9a55",
    sunIntensity: 2.3,
    hemiSky: "#dfa87c",
    hemiGround: "#584631",
    hemiIntensity: 0.42,
    groundColor: "#96805f",
  },
  night: {
    bg: "#11141c",
    sunPos: [-7, 12, -8],
    sunColor: "#93a7cf",
    sunIntensity: 0.4,
    hemiSky: "#26304a",
    hemiGround: "#14151a",
    hemiIntensity: 0.22,
    groundColor: "#17191f",
  },
};

function useEffectiveTime(): TimeOfDay {
  const timeOfDay = useScene((s) => s.lighting.timeOfDay);
  const presenting = useUI((s) => s.presenting);
  const presentationTime = useUI((s) => s.presentationTime);
  return presenting ? presentationTime : timeOfDay;
}

const SMOOTH_K = 5.5;

function LightingRig() {
  const lighting = useScene((s) => s.lighting);
  const time = useEffectiveTime();
  const p = PRESETS[time];

  const dirRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  const target = useMemo(
    () => ({
      sun: new THREE.Color(p.sunColor),
      sky: new THREE.Color(p.hemiSky),
      ground: new THREE.Color(p.hemiGround),
      pos: new THREE.Vector3(...p.sunPos),
    }),
    [p],
  );

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-SMOOTH_K * Math.min(dt, 0.1));
    const dir = dirRef.current;
    const hemi = hemiRef.current;
    if (dir) {
      dir.intensity += (p.sunIntensity * lighting.sunIntensity - dir.intensity) * k;
      dir.color.lerp(target.sun, k);
      dir.position.lerp(target.pos, k);
    }
    if (hemi) {
      hemi.intensity += (p.hemiIntensity * lighting.ambientIntensity - hemi.intensity) * k;
      hemi.color.lerp(target.sky, k);
      hemi.groundColor.lerp(target.ground, k);
    }
  });

  // NOTE: values are driven imperatively by useFrame above so transitions
  // interpolate — do not bind reactive props to preset/lighting state here.
  return (
    <>
      <hemisphereLight ref={hemiRef} args={["#cfdde8", "#8a8074", 0.55]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        ref={dirRef}
        castShadow
        position={[9, 14, 5]}
        intensity={2.6}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {lighting.interiorLightsOn && (
        <>
          <pointLight position={[-1.7, 1.95, -0.55]} color="#ffd9a0" intensity={time === "night" ? 18 : 10} distance={9} decay={2} />
          <pointLight position={[-4.78, 1.86, -1.6]} color="#ffe2b0" intensity={time === "night" ? 12 : 7} distance={7} decay={2} />
          <pointLight position={[2.5, 2.9, -1.5]} color="#ffe8c8" intensity={time === "night" ? 8 : 4} distance={8} decay={2} />
        </>
      )}
      {/* sun / moon disc */}
      <mesh
        position={[
          p.sunPos[0] * 1.5,
          Math.max(p.sunPos[1] * 1.3, 3),
          p.sunPos[2] * 1.5,
        ]}
      >
        <sphereGeometry args={[time === "sunset" ? 2.4 : 1.4, 16, 16]} />
        <meshBasicMaterial color={p.sunColor} transparent opacity={time === "night" ? 0.5 : 0.85} />
      </mesh>
    </>
  );
}

function StudioEnvironment() {
  return (
    <Suspense fallback={null}>
      <Environment resolution={64} frames={1}>
        <color attach="background" args={["#404040"]} />
        <Lightformer intensity={1.6} position={[0, 6, 0]} scale={[12, 12, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.7} position={[6, 2, 0]} scale={[8, 3, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer intensity={0.5} position={[-6, 2, 0]} scale={[8, 3, 1]} rotation-y={Math.PI / 2} />
      </Environment>
      <EnvIntensity value={0.35} />
    </Suspense>
  );
}

function EnvIntensity({ value }: { value: number }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.environmentIntensity = value;
    return () => {
      scene.environmentIntensity = 1;
    };
  }, [scene, value]);
  return null;
}

function Atmosphere() {
  const time = useEffectiveTime();
  const p = PRESETS[time];
  const scene = useThree((s) => s.scene);
  const targetBg = useMemo(() => new THREE.Color(p.bg), [p.bg]);

  useEffect(() => {
    if (!scene.fog) scene.fog = new THREE.Fog(p.bg, 34, 95);
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color(p.bg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-SMOOTH_K * Math.min(dt, 0.1));
    const bg = scene.background;
    if (bg instanceof THREE.Color) bg.lerp(targetBg, k);
    const fog = scene.fog;
    if (fog instanceof THREE.Fog && bg instanceof THREE.Color) fog.color.copy(bg);
  });

  return null;
}

function Ground() {
  const time = useEffectiveTime();
  const p = PRESETS[time];
  const presenting = useUI((s) => s.presenting);

  return (
    <>
      <mesh position={[0, -0.19, 0]} receiveShadow>
        <boxGeometry args={[160, 0.02, 160]} />
        <meshStandardMaterial color={p.groundColor} roughness={0.96} metalness={0} />
      </mesh>
      {!presenting && (
        <Grid
          position={[0, -0.17, 0]}
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.5}
          sectionSize={2}
          sectionThickness={1}
          cellColor="#5d6068"
          sectionColor="#767a84"
          fadeDistance={46}
          fadeStrength={1.4}
        />
      )}
    </>
  );
}

function SnapshotHandler() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const { scale } = (e as CustomEvent<{ scale?: number }>).detail;
      const prevSize = new THREE.Vector2();
      gl.getSize(prevSize);
      const prevRatio = gl.getPixelRatio();
      const w = Math.round(prevSize.x * (scale ?? 1));
      const h = Math.round(prevSize.y * (scale ?? 1));
      try {
        gl.setPixelRatio(1);
        gl.setSize(w, h, false);
        const cam = camera as THREE.PerspectiveCamera;
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
        gl.render(scene, camera);
        window.dispatchEvent(
          new CustomEvent("prebuild:snapshot", { detail: gl.domElement.toDataURL("image/png") }),
        );
      } catch {
        window.dispatchEvent(new CustomEvent("prebuild:snapshot", { detail: "" }));
      } finally {
        gl.setPixelRatio(prevRatio);
        gl.setSize(prevSize.x, prevSize.y, false);
        const cam = camera as THREE.PerspectiveCamera;
        cam.aspect = prevSize.x / prevSize.y;
        cam.updateProjectionMatrix();
        gl.render(scene, camera);
      }
    };
    window.addEventListener("prebuild:snapshot-request", onRequest);
    return () => window.removeEventListener("prebuild:snapshot-request", onRequest);
  }, [gl, scene, camera]);

  return null;
}

export function Viewport() {
  const select = useScene((s) => s.select);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 220, position: [11, 6.5, 11.5] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
      onPointerMissed={() => select(null)}
    >
      <Atmosphere />
      <LightingRig />
      <StudioEnvironment />
      <Ground />
      <SceneNodes />
      <Gizmo />
      <SpawnTracker />
      <SnapshotHandler />
      <OrbitControls
        makeDefault
        target={[0, 1.15, 0]}
        enableDamping
        dampingFactor={0.09}
        minDistance={3}
        maxDistance={42}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
    </Canvas>
  );
}
