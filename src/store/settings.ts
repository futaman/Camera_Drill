import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Quality } from '../render/Engine';
import { safeStorage } from './storage';

export type Mode = 'lessons' | 'simulator' | 'settings';

export interface Settings {
  mode: Mode;
  controlStyle: 'dial' | 'slider';
  quality: Quality;
  zebra: boolean;
  grid: boolean;
  dofBar: boolean;
  topView: boolean;
  showAdvanced: boolean;
  set(patch: Partial<Omit<Settings, 'set'>>): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      mode: 'lessons',
      controlStyle: 'dial',
      quality: 'standard',
      zebra: true,
      grid: false,
      dofBar: true,
      topView: false,
      showAdvanced: false,
      set: (patch) => set(patch),
    }),
    { name: 'camera-drill.settings', storage: safeStorage, version: 1 },
  ),
);

export interface Progress {
  completed: Record<string, boolean>;
  currentLesson: string | null;
  complete(id: string): void;
  setCurrent(id: string): void;
  reset(): void;
}

export const useProgress = create<Progress>()(
  persist(
    (set, get) => ({
      completed: {},
      currentLesson: null,
      complete: (id) => set({ completed: { ...get().completed, [id]: true } }),
      setCurrent: (id) => set({ currentLesson: id }),
      reset: () => set({ completed: {}, currentLesson: null }),
    }),
    { name: 'camera-drill.progress', storage: safeStorage, version: 1 },
  ),
);
