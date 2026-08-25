import { useEffect, useRef, useState } from "react";
import {
  createTemplateObject,
  TEMPLATE_SPAWN_Y,
} from "../../lib/templates";
import { spawnPoint } from "../viewport/VillaScene";
import { useScene } from "../../store/scene";
import { useUI } from "../../store/ui";
import { IconPlus } from "../icons";

interface TemplateEntry {
  key: string;
  label: string;
}

const SECTIONS: { label: string; items: TemplateEntry[] }[] = [
  {
    label: "Furniture",
    items: [
      { key: "sofa", label: "Sofa" },
      { key: "armchair", label: "Armchair" },
      { key: "coffee-table", label: "Coffee Table" },
      { key: "dining-table", label: "Dining Table" },
      { key: "chair", label: "Chair" },
      { key: "bed", label: "Bed" },
      { key: "wardrobe", label: "Wardrobe" },
      { key: "nightstand", label: "Nightstand" },
      { key: "bookshelf", label: "Bookshelf" },
    ],
  },
  {
    label: "Decor & Plants",
    items: [
      { key: "rug", label: "Rug" },
      { key: "plant", label: "Plant" },
    ],
  },
  {
    label: "Lighting",
    items: [
      { key: "floor-lamp", label: "Floor Lamp" },
      { key: "pendant", label: "Pendant Light" },
    ],
  },
  {
    label: "Kitchen",
    items: [
      { key: "kitchen-counter", label: "Counter Run" },
      { key: "kitchen-island", label: "Island" },
      { key: "upper-cabinet", label: "Upper Cabinet" },
      { key: "fridge", label: "Fridge" },
      { key: "stove", label: "Stove" },
    ],
  },
  {
    label: "Bathroom",
    items: [
      { key: "bathtub", label: "Bathtub" },
      { key: "vanity", label: "Vanity" },
    ],
  },
  {
    label: "Structure",
    items: [
      { key: "slab", label: "Floor Slab" },
      { key: "partition", label: "Partition Wall" },
      { key: "column", label: "Column" },
      { key: "stairs", label: "Staircase" },
    ],
  },
];

export function AddMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const addObject = useScene((s) => s.addObject);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const insert = (key: string, label: string) => {
    // Small grid offset so repeated adds don't stack invisibly
    const jitter = (Math.random() - 0.5) * 1.2;
    const y = TEMPLATE_SPAWN_Y[key] ?? 0;
    const obj = createTemplateObject(key, [
      spawnPoint.x + jitter,
      y,
      spawnPoint.z + jitter,
    ]);
    if (!obj) return;
    addObject(obj);
    setOpen(false);
    showToast(`${label} added — drag to position, Materials tab to texture`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title="Add objects to the scene"
        className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
          open ? "bg-accent/15 text-accent" : "text-dim hover:bg-hover hover:text-text"
        }`}
      >
        <IconPlus size={13} />
        Add
      </button>

      {open && (
        <div className="pb-rise absolute left-1/2 top-11 z-40 max-h-[70vh] w-64 -translate-x-1/2 overflow-y-auto rounded-md border border-line bg-surface shadow-pop">
          {SECTIONS.map((section) => (
            <div key={section.label} className="border-b border-line/60 py-1.5 last:border-b-0">
              <p className="px-3 pb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                {section.label}
              </p>
              <div className="grid grid-cols-2 gap-0.5 px-1.5">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => insert(item.key, item.label)}
                    className="truncate rounded-xs px-2 py-1.5 text-left text-[11.5px] text-dim transition-colors hover:bg-hover hover:text-text"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="px-3 py-2 font-mono text-[8.5px] uppercase tracking-wide text-faint/70">
            Spawns at view center
          </p>
        </div>
      )}
    </div>
  );
}
