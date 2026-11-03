// リグとエンジンの計測値から、学習用の指標をまとめて計算する。講座の課題の判定にも使う。

import { getLens } from '../camera/lenses';
import {
  F_STOPS,
  FULL_FRAME,
  ISO_STOPS,
  SS_STOPS,
  angleOfView,
  depthOfField,
  mmToPx,
  permissibleCoc,
  signedCoc,
  type DepthOfField,
} from '../physics';
import type { EngineSettings, Telemetry } from '../render/Engine';
import type { Quality } from '../render/Engine';
import type { RigState } from './rig';

/** 錯乱円などの大きさは「横1000pxの写真で何px」に換算して扱う */
export const REF_WIDTH = 1000;
/** 被写体にピントが合っているとみなす錯乱円（横1000px換算） */
export const SHARP_PX = 1.6;

export interface Analysis {
  n: number;
  t: number;
  iso: number;
  focal: number;
  focusM: number;
  meterStops: number;
  clippedRatio: number;
  crushedRatio: number;
  /** 名前付きの位置の錯乱円（直径、横1000px換算、符号付き） */
  coc: Record<string, number>;
  distances: Record<string, number>;
  dof: DepthOfField;
  shakePx: number;
  motionPx: number;
  horizontalAov: number;
  ready: boolean;
}

export function rigValues(rig: RigState) {
  return { n: F_STOPS[rig.fIndex].value, t: SS_STOPS[rig.ssIndex].value, iso: ISO_STOPS[rig.isoIndex].value };
}

export function engineSettings(
  rig: RigState,
  ui: { quality: Quality; zebra: boolean },
): EngineSettings {
  const { n, t, iso } = rigValues(rig);
  return {
    n,
    t,
    iso,
    focal: rig.focal,
    sensor: FULL_FRAME,
    focusMode: rig.focusMode,
    focusM: rig.focusM,
    minFocusM: getLens(rig.lensId).minFocusM,
    afPoint: rig.afPoint,
    stabilization: rig.stabilization,
    tripod: rig.tripod,
    sceneId: rig.sceneId,
    lighting: rig.lighting,
    params: rig.params,
    zebra: ui.zebra,
    noise: true,
    quality: ui.quality,
  };
}

export function analyze(rig: RigState, tel: Telemetry | null): Analysis {
  const { n, t, iso } = rigValues(rig);
  const focusM = tel?.focusM ?? rig.focusM;
  const coc: Record<string, number> = {};
  for (const [id, d] of Object.entries(tel?.keyDistances ?? {})) {
    coc[id] = mmToPx(signedCoc(rig.focal, n, focusM, d), FULL_FRAME, REF_WIDTH);
  }
  return {
    n,
    t,
    iso,
    focal: rig.focal,
    focusM,
    meterStops: tel?.meterStops ?? 0,
    clippedRatio: tel?.clippedRatio ?? 0,
    crushedRatio: tel?.crushedRatio ?? 0,
    coc,
    distances: tel?.keyDistances ?? {},
    dof: depthOfField(rig.focal, n, focusM, permissibleCoc(FULL_FRAME)),
    shakePx: tel?.shakePx ?? 0,
    motionPx: tel?.motionPx ?? 0,
    horizontalAov: angleOfView(rig.focal, FULL_FRAME.width),
    ready: tel !== null,
  };
}

/** 被写体にピントが合っているか */
export function subjectSharp(a: Analysis): boolean {
  return Math.abs(a.coc.subject ?? 99) <= SHARP_PX;
}

/** 露出がほぼ適正か（±tol 段） */
export function exposureOk(a: Analysis, tol = 2 / 3): boolean {
  return Math.abs(a.meterStops) <= tol;
}
