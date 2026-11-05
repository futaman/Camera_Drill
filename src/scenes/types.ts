import type * as THREE from 'three';

export interface LightingPreset {
  id: string;
  label: string;
}

/** シーンごとの調整項目（スライダーで操作する） */
export interface SceneParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
}

/** 学習の判定や補助表示に使う、名前付きの位置 */
export interface KeyPoint {
  id: 'subject' | 'background' | 'foreground';
  label: string;
  position: THREE.Vector3;
}

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface SceneInstance {
  scene: THREE.Scene;
  /** レイキャスト（AF）の対象 */
  focusTargets: THREE.Object3D[];
  setLighting(id: string): void;
  /** パラメータを反映する。時刻はアニメーションの基準 [秒] */
  update(params: Record<string, number>, timeSec: number): void;
  cameraPose(params: Record<string, number>): CameraPose;
  keyPoints(params: Record<string, number>, timeSec: number): KeyPoint[];
  /** 動く物体の最大速度 [m/s] とカメラからの距離 [m]（被写体ブレの見積もり用） */
  motion(params: Record<string, number>): { speed: number; distance: number };
  /** シーン内で最も近い・遠い物体までの距離の目安 [m] */
  depthRange(params: Record<string, number>): { near: number; far: number };
  dispose(): void;
}

export interface SceneDef {
  id: string;
  name: string;
  description: string;
  lighting: LightingPreset[];
  params: SceneParam[];
  create(): SceneInstance;
}

export function defaultParams(def: SceneDef): Record<string, number> {
  return Object.fromEntries(def.params.map((p) => [p.id, p.default]));
}
