import * as THREE from "three";
import type { TextureKind } from "../types";

/* Deterministic PRNG so textures are stable across reloads */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

export function drawTexture(
  ctx: CanvasRenderingContext2D,
  kind: TextureKind,
  color: string,
  size: number,
) {
  const rand = mulberry32(size * 7 + kind.length * 131 + color.length);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  if (kind === "wood") {
    const plank = size / 4;
    for (let p = 0; p < 4; p++) {
      ctx.fillStyle = shade(color, Math.floor(rand() * 22 - 11));
      ctx.fillRect(p * plank, 0, plank, size);
      // grain streaks
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.04 + rand() * 0.07})`;
        ctx.lineWidth = 0.5 + rand() * 1.4;
        ctx.beginPath();
        const x = p * plank + rand() * plank;
        ctx.moveTo(x, 0);
        for (let y = 0; y <= size; y += size / 6) {
          ctx.lineTo(x + (rand() - 0.5) * 5, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(p * plank, 0, 1.2, size);
    }
  } else if (kind === "marble" || kind === "travertine") {
    const veins = kind === "marble" ? 14 : 26;
    for (let v = 0; v < veins; v++) {
      ctx.strokeStyle =
        kind === "marble"
          ? `rgba(90,95,105,${0.05 + rand() * 0.12})`
          : `rgba(120,100,80,${0.05 + rand() * 0.08})`;
      ctx.lineWidth = 0.6 + rand() * (kind === "marble" ? 2.2 : 3.5);
      ctx.beginPath();
      let x = rand() * size;
      let y = rand() * size;
      ctx.moveTo(x, y);
      const segs = 5 + Math.floor(rand() * 5);
      let angle = rand() * Math.PI * 2;
      for (let s = 0; s < segs; s++) {
        angle += (rand() - 0.5) * 1.4;
        x += Math.cos(angle) * size * 0.12;
        y += Math.sin(angle) * size * 0.12;
        ctx.quadraticCurveTo(
          x + (rand() - 0.5) * 30,
          y + (rand() - 0.5) * 30,
          x,
          y,
        );
      }
      ctx.stroke();
    }
    // soft clouding
    for (let c = 0; c < 10; c++) {
      const gx = rand() * size;
      const gy = rand() * size;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, size * 0.25);
      gr.addColorStop(0, `rgba(${kind === "marble" ? "210,215,222" : "225,205,175"},${rand() * 0.16})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, size, size);
    }
  } else if (kind === "concrete") {
    for (let i = 0; i < 4200; i++) {
      const a = rand() * 0.09;
      ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      const r = 0.4 + rand() * 1.6;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let b = 0; b < 6; b++) {
      const gx = rand() * size;
      const gy = rand() * size;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, size * 0.35);
      gr.addColorStop(0, `rgba(0,0,0,${0.03 + rand() * 0.05})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, size, size);
    }
  } else if (kind === "brushed") {
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "0,0,0"},${rand() * 0.08})`;
      ctx.lineWidth = 0.5 + rand();
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(rand() * size, y);
      ctx.lineTo(rand() * size, y + (rand() - 0.5) * 3);
      ctx.stroke();
    }
  } else if (kind === "glass") {
    const gr = ctx.createLinearGradient(0, 0, size, size);
    gr.addColorStop(0, "rgba(255,255,255,0.06)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.02)");
    gr.addColorStop(1, "rgba(255,255,255,0.07)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, size, size);
  } else if (kind === "tile") {
    const n = 4;
    const cell = size / n;
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.05})`;
      ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
  } else if (kind === "terrazzo") {
    for (let i = 0; i < 3400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.05})`;
      ctx.fillRect(rand() * size, rand() * size, 2, 2);
    }
    const chips = ["#c9b8a3", "#8f8578", "#b5aca0", "#6e675e", "#d9d2c8"];
    for (let c = 0; c < 240; c++) {
      ctx.fillStyle = chips[Math.floor(rand() * chips.length)];
      ctx.globalAlpha = 0.55 + rand() * 0.45;
      ctx.save();
      ctx.translate(rand() * size, rand() * size);
      ctx.rotate(rand() * Math.PI);
      const w = 2 + rand() * 7;
      ctx.beginPath();
      ctx.ellipse(0, 0, w, w * (0.4 + rand() * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  } else if (kind === "fabric" || kind === "velvet") {
    const gap = kind === "velvet" ? 3 : 2;
    for (let y = 0; y < size; y += gap) {
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (rand() - 0.5) * 1.5);
      ctx.stroke();
    }
    for (let x = 0; x < size; x += gap) {
      ctx.strokeStyle = `rgba(255,255,255,${0.02 + rand() * 0.04})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rand() - 0.5) * 1.5, size);
      ctx.stroke();
    }
    if (kind === "velvet") {
      for (let b = 0; b < 14; b++) {
        const gx = rand() * size;
        const gy = rand() * size;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, size * 0.18);
        gr.addColorStop(0, `rgba(255,255,255,${rand() * 0.1})`);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, size, size);
      }
    }
  }
}

const threeCache = new Map<string, THREE.CanvasTexture>();

export function getThreeTexture(kind: TextureKind, color: string, repeat = 2): THREE.CanvasTexture | null {
  if (kind === "plain") return null;
  const key = `${kind}:${color}:${repeat}`;
  const cached = threeCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  drawTexture(ctx, kind, color, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  threeCache.set(key, tex);
  return tex;
}
