import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { objectRegistry } from "../components/viewport/VillaScene";
import { useScene } from "../store/scene";

export function safeFilename(name: string): string {
  return name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Ask the viewport to render offscreen at `scale`× and return a PNG data URL. */
export function requestSnapshot(scale = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Viewport not ready")), 5000);
    window.addEventListener(
      "prebuild:snapshot",
      (e) => {
        clearTimeout(timer);
        resolve((e as CustomEvent<string>).detail);
      },
      { once: true },
    );
    window.dispatchEvent(new CustomEvent("prebuild:snapshot-request", { detail: { scale } }));
  });
}

export async function exportPNG(scale: number, suffix = "") {
  const dataUrl = await requestSnapshot(scale);
  const blob = await (await fetch(dataUrl)).blob();
  const name = safeFilename(useScene.getState().projectName);
  downloadBlob(blob, `${name}${suffix}.png`);
}

export async function exportPresentationHTML() {
  const png = await requestSnapshot(1.6);
  const { projectName } = useScene.getState();
  const objects = Object.values(useScene.getState().objects);
  const byCat = new Map<string, number>();
  for (const o of objects) byCat.set(o.category, (byCat.get(o.category) ?? 0) + 1);
  const rows = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `<div class="stat"><b>${n}</b><span>${c}</span></div>`)
    .join("");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${projectName} — Presentation</title>
<style>
  :root{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
  body{margin:0;background:#111418;color:#f2efe8;display:flex;flex-direction:column;align-items:center;min-height:100vh}
  header{width:100%;padding:28px 40px;box-sizing:border-box;border-bottom:1px solid #262a31;display:flex;justify-content:space-between;align-items:baseline}
  h1{font-size:22px;font-weight:600;margin:0;letter-spacing:.02em}
  .brand{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.3em;color:#8a8f98}
  main{width:min(1200px,94vw);padding:32px 0;box-sizing:border-box}
  img{width:100%;border-radius:10px;display:block;box-shadow:0 24px 80px rgba(0,0,0,.5)}
  .stats{display:flex;gap:14px;flex-wrap:wrap;margin-top:22px}
  .stat{background:#181c22;border:1px solid #262a31;border-radius:8px;padding:12px 18px;min-width:90px}
  .stat b{display:block;font-size:20px}
  .stat span{font-family:ui-monospace,monospace;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#8a8f98}
  footer{padding:20px;color:#565b63;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.08em}
</style></head><body>
<header><h1>${projectName}</h1><span class="brand">PREBUILD</span></header>
<main>
  <img src="${png}" alt="${projectName} render"/>
  <div class="stats">${rows}</div>
</main>
<footer>GENERATED ${new Date().toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}).toUpperCase()} · ${objects.length} OBJECTS</footer>
</body></html>`;
  downloadBlob(new Blob([html], { type: "text/html" }), `${safeFilename(projectName)}-presentation.html`);
}

export async function exportGLB() {
  const objects = useScene.getState().objects;
  const visibleIds = new Set(
    Object.values(objects)
      .filter((o) => o.visible !== false)
      .map((o) => o.id),
  );
  if (!objectRegistry.size) throw new Error("Scene not loaded yet");
  const group = new THREE.Group();
  group.name = useScene.getState().projectName;
  let exported = 0;
  objectRegistry.forEach((root, id) => {
    if (!visibleIds.has(id)) return;
    group.add(root.clone(true));
    exported++;
  });
  if (!exported) throw new Error("No meshes registered");
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });
  const name = safeFilename(useScene.getState().projectName);
  downloadBlob(new Blob([result as ArrayBuffer], { type: "model/gltf-binary" }), `${name}.glb`);
}
