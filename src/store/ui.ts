import { create } from "zustand";
import type { TimeOfDay } from "../types";

export type View = "dashboard" | "editor";
export type RightTab = "properties" | "materials" | "versions";
export type TransformMode = "translate" | "rotate" | "scale";

interface UIStore {
  view: View;
  presenting: boolean;
  rightTab: RightTab;
  transformMode: TransformMode;
  shareOpen: boolean;
  exportOpen: boolean;
  variationsOpen: boolean;
  planOpen: boolean;
  toast: { id: number; message: string } | null;

  setView: (v: View) => void;
  setPresenting: (p: boolean) => void;
  setRightTab: (t: RightTab) => void;
  setTransformMode: (m: TransformMode) => void;
  openShare: () => void;
  closeShare: () => void;
  toggleExport: (open?: boolean) => void;
  setVariationsOpen: (o: boolean) => void;
  openPlan: () => void;
  closePlan: () => void;
  showToast: (message: string) => void;

  presentationTime: TimeOfDay;
  setPresentationTime: (t: TimeOfDay) => void;
}

let toastId = 0;

export const useUI = create<UIStore>((set) => ({
  view: "dashboard",
  presenting: false,
  rightTab: "properties",
  transformMode: "translate",
  shareOpen: false,
  exportOpen: false,
  variationsOpen: false,
  planOpen: false,
  toast: null,

  setView: (view) => set({ view }),
  setPresenting: (presenting) => set({ presenting, exportOpen: false }),
  setRightTab: (rightTab) => set({ rightTab }),
  setTransformMode: (transformMode) => set({ transformMode }),
  openShare: () => set({ shareOpen: true }),
  closeShare: () => set({ shareOpen: false }),
  toggleExport: (open) =>
    set((s) => ({ exportOpen: open ?? !s.exportOpen })),
  setVariationsOpen: (variationsOpen) => set({ variationsOpen }),
  openPlan: () => set({ planOpen: true }),
  closePlan: () => set({ planOpen: false }),
  showToast: (message) => {
    const id = ++toastId;
    set({ toast: { id, message } });
    setTimeout(() => {
      set((s) => (s.toast?.id === id ? { toast: null } : s));
    }, 2600);
  },

  presentationTime: "day",
  setPresentationTime: (presentationTime) => set({ presentationTime }),
}));
