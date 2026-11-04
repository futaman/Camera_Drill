// リグとエンジンの計測値から、学習用の指標をまとめて計算する。講座の課題の判定にも使う。

import { getLens } from '../camera/lenses';
import {
  F_STOPS,
  ISO_STOPS,
  SS_STOPS,
  angleOfView,
  apertureDiameter,
  croppedMegapixels,
  croppedSensor,
  cropFactor,
  depthOfField,
  getBody,
  mmToPx,
  permissibleCoc,
  lightingBalance,
  signedCoc,
  type DepthOfField,
  type LightingBalance,
  type ReflectorKind,
  type StudioLightSetup,
  type ProfileId,
  type Sensor,
  type ShootingMode,
} from '../physics';
import type { EngineSettings, Metering, Quality, Telemetry } from '../render/Engine';
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
  /** 35mm判換算の焦点距離 */
  equivalentFocal: number;
  /** 有効口径 [mm] */
  aperture: number;
  bodyId: string;
  digitalCrop: number;
  sensor: Sensor;
  /** トリミング後の画素数 [MP] */
  megapixels: number;
  mode: ShootingMode;
  autoIso: boolean;
  comp: number;
  metering: Metering;
  profile: ProfileId;
  focusM: number;
  meterStops: number;
  meteredLuminance: number;
  clippedRatio: number;
  crushedRatio: number;
  /** 名前付きの位置の錯乱円（直径、横1000px換算、符号付き） */
  coc: Record<string, number>;
  distances: Record<string, number>;
  dof: DepthOfField;
  shakePx: number;
  motionPx: number;
  horizontalAov: number;
  cameraDistance: number;
  lighting: string;
  /** シーンの調整項目の値 */
  params: Record<string, number>;
  /** スタジオの光の明暗差など（スタジオ以外では null） */
  studio: LightingBalance | null;
  ready: boolean;
}

export function rigValues(rig: RigState) {
  return { n: F_STOPS[rig.fIndex].value, t: SS_STOPS[rig.ssIndex].value, iso: ISO_STOPS[rig.isoIndex].value };
}

/** トリミングも含めた実質のセンサー */
export function effectiveSensor(rig: RigState): Sensor {
  return croppedSensor(getBody(rig.bodyId), rig.digitalCrop);
}

export function engineSettings(rig: RigState, ui: { quality: Quality; zebra: boolean }): EngineSettings {
  const { n, t, iso } = rigValues(rig);
  const lens = getLens(rig.lensId);
  return {
    n,
    t,
    iso,
    focal: rig.focal,
    sensor: effectiveSensor(rig),
    maxApertureN: lens.maxAperture(rig.focal),
    profile: rig.profile,
    lensFx: rig.lensFx,
    metering: rig.metering,
    focusMode: rig.focusMode,
    focusM: rig.focusM,
    minFocusM: lens.minFocusM,
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
  const sensor = effectiveSensor(rig);
  const focusM = tel?.focusM ?? rig.focusM;
  const coc: Record<string, number> = {};
  for (const [id, d] of Object.entries(tel?.keyDistances ?? {})) {
    coc[id] = mmToPx(signedCoc(rig.focal, n, focusM, d), sensor, REF_WIDTH);
  }
  return {
    n,
    t,
    iso,
    focal: rig.focal,
    equivalentFocal: rig.focal * cropFactor(sensor),
    aperture: apertureDiameter(rig.focal, n),
    bodyId: rig.bodyId,
    digitalCrop: rig.digitalCrop,
    sensor,
    megapixels: croppedMegapixels(getBody(rig.bodyId), rig.digitalCrop),
    mode: rig.mode,
    autoIso: rig.autoIso,
    comp: rig.comp,
    metering: rig.metering,
    profile: rig.profile,
    focusM,
    meterStops: tel?.meterStops ?? 0,
    meteredLuminance: tel?.meteredLuminance ?? 0,
    clippedRatio: tel?.clippedRatio ?? 0,
    crushedRatio: tel?.crushedRatio ?? 0,
    coc,
    distances: tel?.keyDistances ?? {},
    dof: depthOfField(rig.focal, n, focusM, permissibleCoc(sensor)),
    shakePx: tel?.shakePx ?? 0,
    motionPx: tel?.motionPx ?? 0,
    horizontalAov: angleOfView(rig.focal, sensor.width),
    cameraDistance: rig.params.distance ?? 0,
    lighting: rig.lighting,
    params: rig.params,
    studio: rig.sceneId === 'studio' ? lightingBalance(studioSetup(rig.params)) : null,
    ready: tel !== null,
  };
}

/** スタジオシーンの調整項目を、光の計算の入力に変換する */
export function studioSetup(p: Record<string, number>): StudioLightSetup {
  return {
    keyAzimuth: p.keyAz,
    keyElevation: p.keyEl,
    keyDistance: p.keyDist,
    keyPower: p.keyPower,
    fill: p.fill,
    reflector: p.reflector as ReflectorKind,
    reflectorAzimuth: p.reflAz,
    reflectorDistance: p.reflDist,
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
