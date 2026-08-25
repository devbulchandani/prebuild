import { useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS, MATERIAL_CATEGORIES, getMaterial } from "../../data/materials";
import { drawTexture } from "../../lib/textures";
import { useScene } from "../../store/scene";
import { IconSearch, IconCheck } from "../icons";

function Swatch({ materialId, size = 56 }: { materialId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mat = getMaterial(materialId);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawTexture(ctx, mat.texture, mat.color, size);
  }, [mat, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="block h-full w-full"
      style={{ imageRendering: "auto" }}
    />
  );
}

export function MaterialBrowser() {
  const [query, setQuery] = useState("");
  const selection = useScene((s) => s.selection);
  const applyMaterial = useScene((s) => s.applyMaterial);
  const objects = useScene((s) => s.objects);

  const selectedObjectId = selection?.kind === "object" ? selection.id : null;
  const selectedMatId = selectedObjectId ? objects[selectedObjectId]?.materialId : null;
  const selectedName = selectedObjectId ? objects[selectedObjectId]?.name : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MATERIALS;
    return MATERIALS.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <div className="flex h-7 items-center gap-2 rounded-sm border border-line bg-raised/60 px-2 focus-within:border-accent-dim">
          <IconSearch size={12} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search materials…"
            className="w-full bg-transparent text-[12px] text-text outline-none placeholder:text-faint"
          />
        </div>
        {selectedObjectId ? (
          <p className="mt-2 truncate font-mono text-[9.5px] uppercase tracking-wider text-faint">
            Applying to · <span className="text-accent">{selectedName}</span>
          </p>
        ) : (
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-wider text-faint/70">
            Select an object to apply
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto pb-6">
        {MATERIAL_CATEGORIES.map((cat) => {
          const items = filtered.filter((m) => m.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat} className="border-b border-line/60 px-3 py-3 last:border-b-0">
              <h4 className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                {cat}
                <span className="h-px flex-1 bg-line" />
                <span>{items.length}</span>
              </h4>
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((m) => {
                  const active = m.id === selectedMatId;
                  return (
                    <button
                      key={m.id}
                      disabled={!selectedObjectId}
                      onClick={() => selectedObjectId && applyMaterial(selectedObjectId, m.id)}
                      title={`${m.name} — roughness ${m.roughness}, metalness ${m.metalness}`}
                      className={`group relative overflow-hidden rounded-sm border transition-all duration-150 ${
                        active
                          ? "border-accent ring-1 ring-accent/40"
                          : "border-line hover:border-line-strong disabled:opacity-45 disabled:hover:border-line"
                      }`}
                    >
                      <div className="aspect-square w-full">
                        <Swatch materialId={m.id} />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-0.5 pt-2">
                        <p className="truncate text-left text-[9px] leading-tight text-text/90">
                          {m.name}
                        </p>
                      </div>
                      {active && (
                        <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-void">
                          <IconCheck size={9} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { Swatch };
