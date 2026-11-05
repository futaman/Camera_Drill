// カメラとシーンの状態（リグ）。シミュレーターは保存されるリグを1つ、講座はステップごとに新しいリグを使う。

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { clampFocal, getLens, minFIndex } from '../camera/lenses';
import { F_STOPS, ISO_STOPS, SS_STOPS, nearestStopIndex } from '../physics';
import { defaultParams, getScene } from '../scenes';
import { safeStorage } from './storage';

export interface RigState {
  fIndex: number;
  ssIndex: number;
  isoIndex: number;
  lensId: string;
  focal: number;
  focusMode: 'af' | 'mf';
  focusM: number;
  afPoint: [number, number];
  stabilization: boolean;
  tripod: boolean;
  sceneId: string;
  lighting: string;
  params: Record<string, number>;
}

export interface RigActions {
  update(patch: Partial<RigState>): void;
  setScene(id: string): void;
  setLens(id: string): void;
  setParam(id: string, value: number): void;
}

export type Rig = RigState & RigActions;
export type RigStore = UseBoundStore<StoreApi<Rig>>;

/** 講座のステップで初期値を書くための形（値は実数で指定し、近い目盛りに合わせる） */
export interface RigInit {
  f?: number;
  ss?: number;
  iso?: number;
  lensId?: string;
  focal?: number;
  focusMode?: 'af' | 'mf';
  focusM?: number;
  afPoint?: [number, number];
  stabilization?: boolean;
  tripod?: boolean;
  sceneId?: string;
  lighting?: string;
  params?: Record<string, number>;
}

export function initialRig(init: RigInit = {}): RigState {
  const scene = getScene(init.sceneId ?? 'atelier');
  const lens = getLens(init.lensId ?? 'zoom-24-70');
  const focal = clampFocal(lens, init.focal ?? 50);
  return {
    fIndex: Math.max(minFIndex(lens, focal), nearestStopIndex(F_STOPS, init.f ?? 5.6)),
    ssIndex: nearestStopIndex(SS_STOPS, init.ss ?? 1 / 60),
    isoIndex: nearestStopIndex(ISO_STOPS, init.iso ?? 400),
    lensId: lens.id,
    focal,
    focusMode: init.focusMode ?? 'af',
    focusM: init.focusM ?? 2,
    afPoint: init.afPoint ?? [0.5, 0.45],
    stabilization: init.stabilization ?? false,
    tripod: init.tripod ?? false,
    sceneId: scene.id,
    lighting: init.lighting ?? scene.lighting[0].id,
    params: { ...defaultParams(scene), ...init.params },
  };
}

function actions(set: StoreApi<Rig>['setState'], get: StoreApi<Rig>['getState']): RigActions {
  return {
    update(patch) {
      set(patch);
    },
    setScene(id) {
      const scene = getScene(id);
      set({ sceneId: scene.id, lighting: scene.lighting[0].id, params: defaultParams(scene), afPoint: [0.5, 0.45] });
    },
    setLens(id) {
      const lens = getLens(id);
      const focal = clampFocal(lens, get().focal);
      set({ lensId: lens.id, focal, fIndex: Math.max(get().fIndex, minFIndex(lens, focal)) });
    },
    setParam(id, value) {
      set({ params: { ...get().params, [id]: value } });
    },
  };
}

export function createRigStore(init: RigInit = {}): RigStore {
  return create<Rig>()((set, get) => ({ ...initialRig(init), ...actions(set, get) }));
}

/** シミュレーターモードのリグ（ブラウザに保存される） */
export const useSimulatorRig: RigStore = create<Rig>()(
  persist((set, get) => ({ ...initialRig(), ...actions(set, get) }), {
    name: 'camera-drill.simulator-rig',
    storage: safeStorage,
    version: 1,
  }),
);
