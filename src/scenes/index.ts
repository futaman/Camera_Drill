import { atelier } from './atelier';
import { garden } from './garden';
import { turntable } from './turntable';
import type { SceneDef } from './types';

export const SCENES: SceneDef[] = [atelier, turntable, garden];

export function getScene(id: string): SceneDef {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

export type { SceneDef, SceneInstance, SceneParam, KeyPoint } from './types';
export { defaultParams } from './types';
