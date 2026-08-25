import { useScene } from "../../store/scene";
import { useUI, type TransformMode } from "../../store/ui";
import { getMaterial } from "../../data/materials";
import type { TimeOfDay } from "../../types";
import { MaterialBrowser, Swatch } from "./MaterialBrowser";
import { VersionsPanel } from "./VersionsPanel";
import { IconMove, IconRotate, IconScale } from "../icons";

/* ---------- primitives ---------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-2">
      <span className="shrink-0 text-[11.5px] text-dim">{label}</span>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  onCommitStart,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommitStart?: () => void;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
      onFocus={onCommitStart}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="h-6 w-full rounded-xs border border-line bg-raised/60 px-1.5 font-mono text-[11px] text-text outline-none transition-colors focus:border-accent-dim"
    />
  );
}

function Slider({
  value,
  onChange,
  onCommitStart,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommitStart?: () => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex w-36 items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onCommitStart}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-faint">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-4 w-7 rounded-full transition-colors duration-150 ${
        checked ? "bg-accent" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-base transition-all duration-150 ${
          checked ? "left-3.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

/* ---------- panels ---------- */

function SceneSettings() {
  const lighting = useScene((s) => s.lighting);
  const setLighting = useScene((s) => s.setLighting);
  const times: { id: TimeOfDay; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "sunset", label: "Sunset" },
    { id: "night", label: "Night" },
  ];

  return (
    <div className="space-y-5 p-3.5">
      <section>
        <SectionLabel>Environment</SectionLabel>
        <Row label="Time of day">
          <div className="flex overflow-hidden rounded-sm border border-line">
            {times.map((t) => (
              <button
                key={t.id}
                onClick={() => setLighting({ timeOfDay: t.id })}
                className={`h-6 px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  lighting.timeOfDay === t.id
                    ? "bg-accent/15 text-accent"
                    : "text-dim hover:bg-hover hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section>
        <SectionLabel>Lighting</SectionLabel>
        <Row label="Sun intensity">
          <Slider
            value={lighting.sunIntensity}
            min={0}
            max={2}
            step={0.05}
            onCommitStart={() => undefined}
            onChange={(v) => setLighting({ sunIntensity: v }, { history: false })}
          />
        </Row>
        <Row label="Ambient">
          <Slider
            value={lighting.ambientIntensity}
            min={0.2}
            max={2}
            step={0.05}
            onChange={(v) => setLighting({ ambientIntensity: v }, { history: false })}
          />
        </Row>
        <Row label="Interior lights">
          <Toggle
            checked={lighting.interiorLightsOn}
            onChange={(v) => setLighting({ interiorLightsOn: v })}
          />
        </Row>
      </section>

      <section>
        <SectionLabel>Camera</SectionLabel>
        <div className="rounded-sm border border-line bg-raised/40 p-2.5 font-mono text-[10.5px] leading-relaxed text-faint">
          <p>PERSPECTIVE · FOV 42°</p>
          <p className="mt-1">ORBIT · LMB&nbsp;&nbsp;PAN · MMB&nbsp;&nbsp;ZOOM · WHEEL</p>
        </div>
      </section>
    </div>
  );
}

function SystemPanel({ id }: { id: "sun" | "ceiling-lights" | "ambient" }) {
  const lighting = useScene((s) => s.lighting);
  const setLighting = useScene((s) => s.setLighting);
  const names = { sun: "Sun", "ceiling-lights": "Ceiling Lights", ambient: "Ambient" };

  return (
    <div className="space-y-5 p-3.5">
      <section>
        <SectionLabel>Object</SectionLabel>
        <Row label="Name">
          <span className="text-[12px] text-text">{names[id]}</span>
        </Row>
        <Row label="Type">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
            Lighting system
          </span>
        </Row>
      </section>
      <section>
        <SectionLabel>{id === "sun" ? "Intensity" : id === "ambient" ? "Level" : "State"}</SectionLabel>
        {id === "sun" && (
          <Row label="Sun intensity">
            <Slider
              value={lighting.sunIntensity}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => setLighting({ sunIntensity: v }, { history: false })}
            />
          </Row>
        )}
        {id === "ambient" && (
          <Row label="Ambient level">
            <Slider
              value={lighting.ambientIntensity}
              min={0.2}
              max={2}
              step={0.05}
              onChange={(v) => setLighting({ ambientIntensity: v }, { history: false })}
            />
          </Row>
        )}
        {id === "ceiling-lights" && (
          <Row label="Powered on">
            <Toggle
              checked={lighting.interiorLightsOn}
              onChange={(v) => setLighting({ interiorLightsOn: v })}
            />
          </Row>
        )}
      </section>
    </div>
  );
}

const MODES: { id: TransformMode; icon: React.ReactNode; title: string }[] = [
  { id: "translate", icon: <IconMove size={13} />, title: "Move" },
  { id: "rotate", icon: <IconRotate size={13} />, title: "Rotate" },
  { id: "scale", icon: <IconScale size={13} />, title: "Scale" },
];

function ObjectPanel({ objectId }: { objectId: string }) {
  const obj = useScene((s) => s.objects[objectId]);
  const updateObject = useScene((s) => s.updateObject);
  const removeObject = useScene((s) => s.removeObject);
  const addObject = useScene((s) => s.addObject);
  const transformMode = useUI((s) => s.transformMode);
  const setTransformMode = useUI((s) => s.setTransformMode);
  const setRightTab = useUI((s) => s.setRightTab);
  const showToast = useUI((s) => s.showToast);
  const overrides = useScene((s) => s.materialOverrides);
  const setMaterialProps = useScene((s) => s.setMaterialProps);

  if (!obj) return null;
  const mat = getMaterial(obj.materialId);
  const eff = { ...mat, ...overrides[mat.id] };
  const pushUndo = () => {
    const s = useScene.getState();
    useScene.setState({
      past: [...s.past.slice(-49), structuredClone({ objects: s.objects, lighting: s.lighting, materialOverrides: s.materialOverrides })],
      future: [],
    });
  };

  return (
    <div className="space-y-5 p-3.5">
      {/* Object */}
      <section>
        <SectionLabel>Object</SectionLabel>
        <input
          key={obj.id}
          defaultValue={obj.name}
          onBlur={(e) =>
            e.target.value !== obj.name && updateObject(obj.id, { name: e.target.value })
          }
          className="h-7 w-full rounded-xs border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-text outline-none transition-colors hover:border-line focus:border-accent-dim focus:bg-raised/60"
        />
        <Row label="Type">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
            {obj.category}
          </span>
        </Row>
        <div className="mt-1.5 flex gap-1.5">
          <button
            onClick={() => {
              const copy = structuredClone(obj);
              copy.id = `${obj.id}-copy-${Date.now().toString(36).slice(-4)}`;
              copy.name = `${obj.name} copy`;
              copy.position = [copy.position[0] + 0.6, copy.position[1], copy.position[2] + 0.6];
              addObject(copy);
              showToast(`${obj.name} duplicated`);
            }}
            className="h-6 flex-1 rounded-xs border border-line font-mono text-[9.5px] uppercase tracking-wider text-dim transition-colors hover:border-accent/50 hover:text-accent"
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              removeObject(obj.id);
              showToast(`${obj.name} deleted`);
            }}
            className="h-6 flex-1 rounded-xs border border-line font-mono text-[9.5px] uppercase tracking-wider text-dim transition-colors hover:border-red-400/60 hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </section>

      {/* Transform */}
      <section>
        <SectionLabel>
          Transform
          <span className="ml-auto flex gap-0.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                title={m.title}
                onClick={() => setTransformMode(m.id)}
                className={`flex h-5 w-5 items-center justify-center rounded-xs transition-colors ${
                  transformMode === m.id
                    ? "bg-accent/15 text-accent"
                    : "text-faint hover:bg-hover hover:text-dim"
                }`}
              >
                {m.icon}
              </button>
            ))}
          </span>
        </SectionLabel>
        {(["x", "y", "z"] as const).map((axis, i) => (
          <Row key={axis} label={`Position ${axis.toUpperCase()}`}>
            <NumInput
              value={obj.position[i]}
              onCommitStart={pushUndo}
              onChange={(v) => {
                const p = [...obj.position] as [number, number, number];
                p[i] = v;
                updateObject(obj.id, { position: p }, { history: false });
              }}
            />
          </Row>
        ))}
        <Row label="Rotation Y°">
          <NumInput
            value={(obj.rotationY * 180) / Math.PI}
            onCommitStart={pushUndo}
            onChange={(v) => updateObject(obj.id, { rotationY: (v * Math.PI) / 180 }, { history: false })}
          />
        </Row>
        <Row label="Uniform scale">
          <Slider
            value={obj.scale[0]}
            min={0.25}
            max={3}
            step={0.05}
            onCommitStart={pushUndo}
            onChange={(v) => updateObject(obj.id, { scale: [v, v, v] }, { history: false })}
          />
        </Row>
      </section>

      {/* Appearance */}
      <section>
        <SectionLabel>Appearance</SectionLabel>
        <button
          onClick={() => setRightTab("materials")}
          className="mb-2 flex w-full items-center gap-2.5 rounded-sm border border-line bg-raised/50 p-2 text-left transition-colors hover:border-accent-dim"
        >
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xs border border-line">
            <Swatch materialId={mat.id} size={36} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-text">{mat.name}</span>
            <span className="block font-mono text-[9.5px] uppercase tracking-wider text-faint">
              {mat.category} · click to change
            </span>
          </span>
        </button>
        <Row label="Roughness">
          <Slider
            value={eff.roughness}
            onCommitStart={() => pushUndo()}
            onChange={(v) => setMaterialProps(mat.id, { roughness: v }, { history: false })}
          />
        </Row>
        <Row label="Metallic">
          <Slider
            value={eff.metalness}
            onCommitStart={() => pushUndo()}
            onChange={(v) => setMaterialProps(mat.id, { metalness: v }, { history: false })}
          />
        </Row>
        <Row label="Opacity">
          <Slider
            value={eff.opacity}
            min={0.05}
            onCommitStart={() => pushUndo()}
            onChange={(v) => setMaterialProps(mat.id, { opacity: v }, { history: false })}
          />
        </Row>
        <Row label="Color">
          <label className="relative h-6 w-12 cursor-pointer overflow-hidden rounded-xs border border-line">
            <input
              type="color"
              value={eff.color}
              onChange={(e) => setMaterialProps(mat.id, { color: e.target.value }, { history: false })}
              className="absolute -inset-2 cursor-pointer"
            />
          </label>
        </Row>
      </section>

      {/* Lighting flags */}
      <section>
        <SectionLabel>Shadows</SectionLabel>
        <Row label="Cast shadows">
          <Toggle
            checked={obj.castShadow}
            onChange={(v) => updateObject(obj.id, { castShadow: v })}
          />
        </Row>
        <Row label="Receive shadows">
          <Toggle
            checked={obj.receiveShadow}
            onChange={(v) => updateObject(obj.id, { receiveShadow: v })}
          />
        </Row>
      </section>
    </div>
  );
}

export function RightPanel() {
  const selection = useScene((s) => s.selection);
  const rightTab = useUI((s) => s.rightTab);
  const setRightTab = useUI((s) => s.setRightTab);

  const selectedObjectId = selection?.kind === "object" ? selection.id : null;

  return (
    <aside className="pointer-events-auto flex w-72 shrink-0 flex-col overflow-hidden rounded-md border border-line bg-base/95 shadow-soft backdrop-blur-md">
      <div className="flex h-11 shrink-0 items-center px-2">
        <div className="flex w-full items-center gap-0.5 rounded-full bg-raised p-0.5">
          {(["properties", "materials", "versions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setRightTab(t)}
              className={`flex-1 rounded-full py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-all ${
                rightTab === t
                  ? "bg-surface text-text shadow-soft"
                  : "text-faint hover:text-dim"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rightTab === "materials" ? (
          <MaterialBrowser />
        ) : rightTab === "versions" ? (
          <VersionsPanel />
        ) : selectedObjectId ? (
          <ObjectPanel objectId={selectedObjectId} />
        ) : selection?.kind === "system" ? (
          <SystemPanel id={selection.id} />
        ) : (
          <SceneSettings />
        )}
      </div>
    </aside>
  );
}
