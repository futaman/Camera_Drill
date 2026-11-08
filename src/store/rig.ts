// カメラとシーンの状態（リグ）。シミュレーターは保存されるリグを1つ、講座はステップごとに新しいリグを使う。

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { clampFocal, getLens, minFIndex } from '../camera/lenses';
import {
  F_STOPS,
  ISO_STOPS,
  NO_FX,
  SS_STOPS,
  getProfile,
  nearestStopIndex,
  type LensFx,
  type ProfileId,
  type ShootingMode,
} from '../physics';
import type { Metering } from '../render/Engine';
import { defaultParams, getScene } from '../scenes';
import { safeStorage } from './storage';

export interface RigState {
  fIndex: number;
  ssIndex: number;
  isoIndex: number;
  bodyId: string;
  /** 中央を切り出す倍率。1 でトリミングなし */
  digitalCrop: number;
  lensId: string;
  focal: number;
  focusMode: 'af' | 'mf';
  focusM: number;
  afPoint: [number, number];
  stabilization: boolean;
  tripod: boolean;
  mode: ShootingMode;
  autoIso: boolean;
  comp: number;
  metering: Metering;
  profile: ProfileId;
  lensFx: LensFx;
  /** 被写体の大きさを保つときの「距離 ÷ 焦点距離」[m/mm]。null で無効 */
  framingLock: number | null;
  sceneId: string;
  lighting: string;
  params: Record<string, number>;
}

export interface RigActions {
  update(patch: Partial<RigState>): void;
  setScene(id: string): void;
  setLens(id: string): void;
  setFocal(focal: number): void;
  setBody(id: string): void;
  setProfile(id: ProfileId): void;
  setFramingLock(on: boolean): void;
  setParam(id: string, value: number): void;
  applyParams(params: Record<string, number>): void;
}

export type Rig = RigState & RigActions;
export type RigStore = UseBoundStore<StoreApi<Rig>>;

/** 講座のステップで初期値を書くための形（値は実数で指定し、近い目盛りに合わせる） */
export interface RigInit {
  f?: number;
  ss?: number;
  iso?: number;
  bodyId?: string;
  digitalCrop?: number;
  lensId?: string;
  focal?: number;
  focusMode?: 'af' | 'mf';
  focusM?: number;
  afPoint?: [number, number];
  stabilization?: boolean;
  tripod?: boolean;
  mode?: ShootingMode;
  autoIso?: boolean;
  comp?: number;
  metering?: Metering;
  profile?: ProfileId;
  lensFx?: Partial<LensFx>;
  framingLock?: boolean;
  sceneId?: string;
  lighting?: string;
  params?: Record<string, number>;
}

export function initialRig(init: RigInit = {}): RigState {
  const scene = getScene(init.sceneId ?? 'atelier');
  const lens = getLens(init.lensId ?? 'zoom-24-70');
  const focal = clampFocal(lens, init.focal ?? 50);
  const params = { ...defaultParams(scene), ...init.params };
  return {
    fIndex: Math.max(minFIndex(lens, focal), nearestStopIndex(F_STOPS, init.f ?? 5.6)),
    ssIndex: nearestStopIndex(SS_STOPS, init.ss ?? 1 / 60),
    isoIndex: nearestStopIndex(ISO_STOPS, init.iso ?? 400),
    bodyId: init.bodyId ?? 'ff-24',
    digitalCrop: init.digitalCrop ?? 1,
    lensId: lens.id,
    focal,
    focusMode: init.focusMode ?? 'af',
    focusM: init.focusM ?? 2,
    afPoint: init.afPoint ?? [0.5, 0.45],
    stabilization: init.stabilization ?? false,
    tripod: init.tripod ?? false,
    mode: init.mode ?? 'M',
    autoIso: init.autoIso ?? false,
    comp: init.comp ?? 0,
    metering: init.metering ?? 'evaluative',
    profile: init.profile ?? 'standard',
    lensFx: { ...NO_FX, ...init.lensFx },
    framingLock: init.framingLock ? (params.distance ?? 2) / focal : null,
    sceneId: scene.id,
    lighting: init.lighting ?? scene.lighting[0].id,
    params,
  };
}

function actions(set: StoreApi<Rig>['setState'], get: StoreApi<Rig>['getState']): RigActions {
  return {
    update(patch) {
      set(patch);
    },
    setScene(id) {
      const scene = getScene(id);
      set({
        sceneId: scene.id,
        lighting: scene.lighting[0].id,
        params: defaultParams(scene),
        afPoint: [0.5, 0.45],
        framingLock: null,
      });
    },
    setLens(id) {
      const lens = getLens(id);
      get().setFocal(clampFocal(lens, get().focal));
      set({ lensId: lens.id, fIndex: Math.max(get().fIndex, minFIndex(lens, get().focal)) });
    },
    setFocal(focal) {
      const { framingLock, lensId, sceneId, params } = get();
      const patch: Partial<RigState> = {
        focal,
        fIndex: Math.max(get().fIndex, minFIndex(getLens(lensId), focal)),
      };
      if (framingLock !== null) {
        // 被写体の大きさを保つよう、焦点距離に比例してカメラを動かす
        const p = getScene(sceneId).params.find((x) => x.id === 'distance');
        if (p) {
          const distance = Math.min(p.max, Math.max(p.min, framingLock * focal));
          patch.params = { ...params, distance };
        }
      }
      set(patch);
    },
    setBody(id) {
      set({ bodyId: id, digitalCrop: 1 });
    },
    setProfile(id) {
      const minIso = getProfile(id).minIso;
      const isoIndex = Math.max(get().isoIndex, nearestStopIndex(ISO_STOPS, minIso));
      set({ profile: id, isoIndex });
    },
    setFramingLock(on) {
      const { params, focal } = get();
      set({ framingLock: on ? (params.distance ?? 2) / focal : null });
    },
    applyParams(params) {
      set({ params: { ...get().params, ...params } });
    },
    setParam(id, value) {
      const patch: Partial<RigState> = { params: { ...get().params, [id]: value } };
      if (id === 'distance' && get().framingLock !== null) patch.framingLock = value / get().focal;
      set(patch);
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
    version: 2,
    // 古い保存データは足りない項目だけ初期値で補う
    migrate: (persisted) => ({ ...initialRig(), ...(persisted as Partial<RigState>) }) as Rig,
  }),
);

// 開発時にブラウザのコンソールから状態を操作できるようにする
if (import.meta.env.DEV) {
  (window as unknown as { __rig: RigStore }).__rig = useSimulatorRig;
}
