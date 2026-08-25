# Prebuild

Premium architectural visualization studio in the browser. Describe a design, import a 2D floor plan, or build by hand — then present it.

**Stack:** React · TypeScript · Vite · Tailwind CSS v4 · React Three Fiber (three.js) · Zustand

## Run

```bash
npm install
npm run dev        # http://localhost:5180
```

Optional — create `.env` from `.env.example` for direct API keys:

```
VITE_GEMINI_API_KEY=...
VITE_OPENAI_API_KEY=...      # also enables vision fallbacks
VITE_ANTHROPIC_API_KEY=...
```

## Features

### Design creation
- **AI commands** — natural-language edits ("make the walls walnut", "add a kitchen along the north wall", "design a modern villa with a pool"). Whole-design requests generate a full layout; targeted edits apply constructive ops (add/move/material/visibility) atomically.
- **2D plan import** — drop a floor-plan image; vision models read rooms/walls/openings and build the 3D scene.
- **Manual building** — Add menu (top toolbar) inserts furniture, kitchen, bathroom, lighting and structural objects at your view center. Move / rotate / scale via gizmo or numeric inputs. Duplicate & delete from Properties.
- **Materials** — 26 procedural materials (marble, walnut, terrazzo, brass, fabrics…) applied per-object or globally; per-material color/roughness/metalness/opacity overrides.

### Scene management
- **Hierarchy tree** — live sidebar listing every object grouped by category (floors, architecture, interior), click to select, eye to hide.
- **Version history** — auto-committed checkpoints with thumbnails; hover to peek, restore any version (undoable).
- **Undo/redo** — full snapshot stack (⌘Z / ⇧⌘Z).
- **Project naming** — click the project name in the top bar to rename.

### Presentation & export
- **Preview mode** — day / sunset / night client view with smooth light transitions.
- **Share link** modal.
- **Exports** (all real downloads):
  - PNG of current viewport
  - High-res render (2.5×)
  - Standalone HTML presentation deck
  - GLB 3D model (opens in Blender, three.js, etc.)

## AI engines

Configured in Settings (gear icon). Priority order is respected per request; image understanding tries all ready vision providers.

| Type | Engines | Notes |
|---|---|---|
| Cloud API | Gemini · OpenAI · Anthropic | key required |
| Local CLI agents | `opencode run` · `claude -p` | detected automatically via `/api/cli-check`; images passed as temp files |

If every engine fails, a local rules engine still handles common requests (kitchens, second floors, material swaps).

## Project structure

```
src/
  components/
    dashboard/       project cards, new project flow
    editor/          TopBar, LeftSidebar (live tree), RightPanel (properties/
                     materials/versions), AIBar, PlanImportModal, SettingsModal,
                     modals, AddMenu
    viewport/        Viewport (canvas, lighting presets, snapshot bridge),
                     VillaScene (scene nodes, gizmo, part meshes, spawn point)
  lib/               templates (object catalog), materials data, plans (layout
                     parsing/building), llm (multi-engine dispatch), exporters
  scene/             initial villa scene
  store/             scene (objects/selection/history), ai (ops engine),
                     settings (persisted keys/providers), ui
  types/
vite.config.ts      includes CLI bridge plugin (/api/cli-check, /api/cli-agent,
                    /api/upload-image)
```

## Notes & caveats

- Dev server port is fixed at **5180** (`--strictPort`).
- CLI-agent tasks can take minutes for heavy generations; timeouts are ~5 min on both bridge and client.
- GLB export includes only currently visible objects.
- Version thumbnails require `preserveDrawingBuffer` (enabled in the Canvas config).
