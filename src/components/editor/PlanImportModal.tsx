import { useEffect, useRef, useState } from "react";
import { useUI } from "../../store/ui";
import { useScene } from "../../store/scene";
import { useVersions } from "../../store/versions";
import { hasVisionEngine } from "../../lib/llm";
import { useSettings } from "../../store/settings";
import {
  SAMPLE_PLAN,
  buildSceneFromPlan,
  detectPlanFromImage,
  type LayoutPlan,
} from "../../lib/plans";
import { IconClose, IconSparkle, IconCheck, IconCube, PrebuildMark } from "../icons";

export function PlanImportModal() {
  const open = useUI((s) => s.planOpen);
  const close = useUI((s) => s.closePlan);
  const showToast = useUI((s) => s.showToast);
  const replaceScene = useScene((s) => s.replaceScene);

  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "detecting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LayoutPlan | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const provider = useSettings((s) => s.provider);
  const cli = useSettings((s) => s.cliAvailable);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUI.getState().closePlan();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  // Re-computed on settings changes so the Detect button reacts live
  void provider;
  void cli;
  const visionReady = hasVisionEngine();

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG or JPG floor plan).");
      return;
    }
    setError(null);
    setPlan(null);
    setStatus("idle");
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const detect = async () => {
    if (!image) return;
    setStatus("detecting");
    setError(null);
    try {
      const result = await detectPlanFromImage(image);
      if (!result.walls.length) throw new Error("NO_WALLS");
      setPlan(result);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof Error && err.message === "NO_VISION_ENGINE"
          ? "No vision-capable engine configured — add a Gemini, OpenAI or Anthropic key in settings."
          : err instanceof Error && err.message === "NO_WALLS"
            ? "Couldn't find walls in that image. Try a clearer plan."
            : "Detection failed — check your connection and try again.",
      );
    }
  };

  const build = () => {
    if (!plan) return;
    const objects = buildSceneFromPlan(plan);
    replaceScene(objects);
    // Safety checkpoint so the imported state can be rolled back.
    setTimeout(() => {
      useVersions.getState().commit("Imported from 2D plan");
      useUI.getState().showToast(`3D scene built · ${plan.rooms.length} rooms · ${objects.length} objects`);
    }, 60);
    close();
  };

  return (
    <div
      className="pb-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="pb-rise flex max-h-[86vh] w-[540px] flex-col overflow-hidden rounded-md border border-line bg-surface shadow-pop">
        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="text-[14px] font-medium text-text">Create 3D from 2D Plan</h3>
            <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
              Upload a floor plan · Gemini extracts walls, rooms & furniture
            </p>
          </div>
          <button onClick={close} className="text-faint transition-colors hover:text-text">
            <IconClose size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* drop zone / preview */}
          {!image ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed transition-colors ${
                dragOver ? "border-accent bg-accent/5" : "border-line-strong/70 hover:border-line-strong hover:bg-raised/40"
              }`}
            >
              <PrebuildMark size={26} />
              <p className="text-[13px] text-dim">Drop a floor plan image here</p>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-faint">
                PNG · JPG · architectural drawings work best
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-sm border border-line">
              <img src={image} alt="floor plan" className="max-h-56 w-full bg-white object-contain" />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          />

          {error && (
            <p className="rounded-sm border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-accent">
              {error}
            </p>
          )}

          {/* detection result summary */}
          {status === "done" && plan && (
            <div className="pb-rise space-y-2 rounded-sm border border-line bg-raised/40 p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
                <IconCheck size={12} /> Layout detected
              </p>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                <span className="text-dim">{plan.walls.length} walls</span>
                <span className="text-dim">{plan.rooms.length} rooms</span>
                <span className="text-dim">{plan.items.length} furniture pieces</span>
              </div>
              {plan.rooms.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {plan.rooms.map((r, i) => (
                    <span key={i} className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">
                      {r.name} {(r.w).toFixed(1)}×{(r.d).toFixed(1)}m
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === "detecting" && (
            <div className="flex items-center gap-2.5 rounded-sm border border-line bg-raised/40 px-3 py-2.5">
              <IconSparkle size={14} className="animate-pulse text-accent" />
              <span className="pb-shimmer text-[12.5px] font-medium">Reading the drawing…</span>
            </div>
          )}
        </div>

        {/* footer actions */}
        <div className="flex items-center gap-1.5 border-t border-line px-4 py-3">
          <button
            onClick={() => {
              setPlan(SAMPLE_PLAN);
              setImage(null);
              setStatus("done");
              setError(null);
            }}
            className="h-8 rounded-sm px-2.5 font-mono text-[10.5px] uppercase tracking-wider text-dim transition-colors hover:bg-hover hover:text-text"
          >
            Try sample plan
          </button>

          <span className="flex-1" />

          {image && status !== "done" && (
            <button
              onClick={detect}
              disabled={!visionReady || status === "detecting"}
              title={!visionReady ? "Configure a vision-capable engine in settings" : undefined}
              className="flex h-8 items-center gap-1.5 rounded-sm border border-accent-dim/60 px-3 font-mono text-[10.5px] uppercase tracking-wider text-accent transition-colors enabled:hover:bg-accent enabled:hover:text-void disabled:opacity-35"
            >
              <IconSparkle size={12} />
              Detect layout
            </button>
          )}

          {image && status !== "done" && !visionReady && (
            <button
              onClick={() => fileRef.current?.click()}
              className="h-8 rounded-sm px-2.5 font-mono text-[10.5px] uppercase tracking-wider text-dim transition-colors hover:bg-hover hover:text-text"
            >
              Choose another
            </button>
          )}

          {status === "done" && plan && (
            <button
              onClick={build}
              className="flex h-8 items-center gap-1.5 rounded-sm bg-accent px-3 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-void transition-opacity hover:opacity-85"
            >
              <IconCube size={12} />
              Build 3D Scene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
