import { useEffect } from "react";
import { useScene } from "./store/scene";
import { useUI } from "./store/ui";
import { TopBar } from "./components/editor/TopBar";
import { LeftSidebar } from "./components/editor/LeftSidebar";
import { RightPanel } from "./components/editor/RightPanel";
import { AIBar } from "./components/editor/AIBar";
import { Viewport } from "./components/viewport/Viewport";
import { PresentationOverlay } from "./components/editor/PresentationOverlay";
import { ShareModal, Toast } from "./components/editor/modals";
import { PlanImportModal } from "./components/editor/PlanImportModal";
import { SettingsModal } from "./components/editor/SettingsModal";
import { refreshCliAvailability } from "./store/settings";
import { DashboardPage } from "./components/dashboard/DashboardPage";

function Editor() {
  const presenting = useUI((s) => s.presenting);

  if (presenting) {
    return (
      <div className="relative h-full">
        <Viewport />
        <PresentationOverlay />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Full-bleed 3D canvas */}
      <div className="absolute inset-0">
        <Viewport />
      </div>

      {/* Floating UI layer */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
          <LeftSidebar />
          <div className="flex-1" />
          <RightPanel />
        </div>
      </div>

      <AIBar />
    </div>
  );
}

export default function App() {
  const view = useUI((s) => s.view);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUI.getState().view !== "editor" || useUI.getState().presenting) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? useScene.getState().redo() : useScene.getState().undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    refreshCliAvailability();
  }, []);

  return (
    <div className="h-full select-none">
      {view === "dashboard" ? <DashboardPage /> : <Editor />}
      <ShareModal />
      <PlanImportModal />
      <SettingsModal />
      <Toast />
    </div>
  );
}
