import { useMemo, useState } from "react";
import { useScene } from "../../store/scene";
import { IconChevron, IconEye, IconEyeOff } from "../icons";
import type { ObjectCategory } from "../../types";

/* ---------- rows ---------- */

function ObjectRow({ objectId }: { objectId: string }) {
  const obj = useScene((s) => (objectId in s.objects ? s.objects[objectId] : null));
  const selection = useScene((s) => s.selection);
  const select = useScene((s) => s.select);
  const toggleVisibility = useScene((s) => s.toggleVisibility);

  if (!obj) return null;
  const selected = selection?.kind === "object" && selection.id === objectId;

  return (
    <div
      onClick={() => select({ kind: "object", id: objectId })}
      className={`group flex h-6 cursor-pointer items-center gap-1 pr-1.5 text-[12px] transition-colors duration-100 ${
        selected ? "bg-accent/10 text-text" : "text-dim hover:bg-hover/70 hover:text-text"
      }`}
    >
      <span className={`h-3 w-[2px] shrink-0 rounded-full ${selected ? "bg-accent" : "bg-transparent"}`} />
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          obj.visible ? "bg-line-strong" : "bg-faint/40"
        }`}
      />
      <span className="flex-1 truncate">{obj.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleVisibility(objectId);
        }}
        title={obj.visible ? "Hide" : "Show"}
        className={`rounded-sm p-0.5 transition-colors ${
          obj.visible ? "text-faint opacity-0 group-hover:opacity-100" : "text-faint"
        } hover:text-text`}
      >
        {obj.visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
      </button>
    </div>
  );
}

function GroupHeader({
  label,
  count,
  open,
  onToggle,
  depth,
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  depth: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex h-6 w-full items-center gap-1 pr-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-dim"
      style={{ paddingLeft: depth * 12 + 2 }}
    >
      <IconChevron
        size={10}
        className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      />
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </button>
  );
}

/* ---------- dynamic tree ---------- */

const CATEGORY_TREE: {
  label: string;
  cats?: ObjectCategory[];
  children?: { label: string; cats: ObjectCategory[] }[];
}[] = [
  { label: "Floors", cats: ["floors"] },
  {
    label: "Architecture",
    children: [
      { label: "Walls", cats: ["walls"] },
      { label: "Ceilings", cats: ["ceilings"] },
      { label: "Doors", cats: ["doors"] },
      { label: "Windows", cats: ["windows"] },
      { label: "Stairs", cats: ["stairs"] },
      { label: "Columns", cats: ["columns"] },
    ],
  },
  {
    label: "Interior",
    children: [
      { label: "Furniture", cats: ["furniture"] },
      { label: "Fixtures", cats: ["fixtures"] },
      { label: "Plants", cats: ["plants"] },
      { label: "Decor", cats: ["decor"] },
    ],
  },
];

export function LeftSidebar() {
  const objects = useScene((s) => s.objects);
  const projectName = useScene((s) => s.projectName);
  const interiorLightsOn = useScene((s) => s.lighting.interiorLightsOn);
  const setLighting = useScene((s) => s.setLighting);

  // Group live scene objects by category — the tree always reflects reality.
  const byCat = useMemo(() => {
    const map = new Map<ObjectCategory, string[]>();
    for (const o of Object.values(objects)) {
      const list = map.get(o.category) ?? [];
      list.push(o.id);
      map.set(o.category, list);
    }
    return map;
  }, [objects]);

  const [openRoot, setOpenRoot] = useState<Record<string, boolean>>({
    Floors: true,
    Architecture: true,
    Interior: true,
  });
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({});
  const toggle = (setter: typeof setOpenRoot, key: string) =>
    setter((s) => ({ ...s, [key]: s[key] === undefined ? false : !s[key] }));

  return (
    <aside className="pointer-events-auto flex max-h-full w-60 shrink-0 self-start flex-col overflow-hidden rounded-md border border-line bg-base/95 shadow-soft backdrop-blur-md">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
          Scene Hierarchy
        </span>
        <span className="font-mono text-[9px] text-faint/70">
          {Object.keys(objects).length}
        </span>
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-y-auto py-1.5">
        {/* project root */}
        <div className="flex h-7 items-center gap-1 pl-2 pr-2">
          <span className="h-1.5 w-1.5 rounded-sm bg-accent" />
          <span className="flex-1 truncate text-[12.5px] font-medium text-text">
            {projectName}
          </span>
        </div>

        {CATEGORY_TREE.map((section) => {
          const ids = section.cats?.flatMap((c) => byCat.get(c) ?? []) ?? [];
          const childTotal =
            section.children?.reduce(
              (n, c) => n + (c.cats.reduce((m, cat) => m + (byCat.get(cat)?.length ?? 0), 0)),
              0,
            ) ?? 0;
          const total = ids.length + childTotal;
          if (total === 0) return null; // hide empty groups entirely
          const open = openRoot[section.label] ?? true;

          return (
            <div key={section.label}>
              <GroupHeader
                label={section.label}
                count={total}
                open={open}
                onToggle={() => toggle(setOpenRoot, section.label)}
                depth={1}
              />
              {open && section.cats && ids.map((id) => <ObjectRow key={id} objectId={id} />)}
              {open &&
                section.children?.map((child) => {
                  const childIds = child.cats.flatMap((cat) => byCat.get(cat) ?? []);
                  if (!childIds.length) return null;
                  const subOpen = openSub[child.label] ?? true;
                  return (
                    <div key={child.label}>
                      <GroupHeader
                        label={child.label}
                        count={childIds.length}
                        open={subOpen}
                        onToggle={() => toggle(setOpenSub as typeof setOpenRoot, child.label)}
                        depth={2}
                      />
                      {subOpen && childIds.map((id) => <ObjectRow key={id} objectId={id} />)}
                    </div>
                  );
                })}
            </div>
          );
        })}

        {/* lighting systems */}
        <div className="mt-1 border-t border-line/60 pt-1">
          <GroupHeader label="Lighting" open onToggle={() => {}} depth={1} />
          <SystemRow id="sun" label="Sun" on={true} />
          <SystemRow
            id="ceiling-lights"
            label="Ceiling Lights"
            on={interiorLightsOn}
            onToggle={() => setLighting({ interiorLightsOn: !interiorLightsOn })}
          />
          <SystemRow id="ambient" label="Ambient" on={true} />
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-4 py-2">
        <p className="font-mono text-[8.5px] uppercase tracking-wide text-faint/70">
          Click to select · eye to hide · double-click name in Properties to rename
        </p>
      </div>
    </aside>
  );
}

function SystemRow({
  id,
  label,
  on,
  onToggle,
}: {
  id: "sun" | "ceiling-lights" | "ambient";
  label: string;
  on: boolean;
  onToggle?: () => void;
}) {
  const selection = useScene((s) => s.selection);
  const select = useScene((s) => s.select);
  const selected = selection?.kind === "system" && selection.id === id;

  return (
    <div
      onClick={() => select({ kind: "system", id })}
      className={`group flex h-6 cursor-pointer items-center gap-1 pl-6 pr-1.5 text-[12px] transition-colors duration-100 ${
        selected ? "bg-accent/10 text-text" : "text-dim hover:bg-hover/70 hover:text-text"
      }`}
    >
      <span className={`h-3 w-[2px] shrink-0 rounded-full ${selected ? "bg-accent" : "bg-transparent"}`} />
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-accent" : "bg-line-strong"}`} />
      <span className="flex-1 truncate">{label}</span>
      {onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`rounded-sm p-0.5 transition-colors ${on ? "text-accent" : "text-faint"} hover:text-text`}
          title={on ? "Turn off" : "Turn on"}
        >
          {on ? <IconEye size={12} /> : <IconEyeOff size={12} />}
        </button>
      )}
    </div>
  );
}
