import { F_STOPS, nearestStopIndex } from '../physics';

export interface Lens {
  id: string;
  name: string;
  minFocal: number; // mm
  maxFocal: number; // mm
  /** 最短撮影距離 [m] */
  minFocusM: number;
  /** 焦点距離ごとの開放F値 */
  maxAperture: (focalMm: number) => number;
}

export const LENSES: Lens[] = [
  {
    id: 'zoom-24-70',
    name: '24-70mm F2.8',
    minFocal: 24,
    maxFocal: 70,
    minFocusM: 0.38,
    maxAperture: () => 2.8,
  },
  {
    id: 'prime-50',
    name: '50mm F1.4',
    minFocal: 50,
    maxFocal: 50,
    minFocusM: 0.45,
    maxAperture: () => 1.4,
  },
];

export function getLens(id: string): Lens {
  return LENSES.find((l) => l.id === id) ?? LENSES[0];
}

/** そのレンズ・焦点距離で選べる最小のF値の目盛り */
export function minFIndex(lens: Lens, focalMm: number): number {
  return nearestStopIndex(F_STOPS, lens.maxAperture(focalMm));
}

export function clampFocal(lens: Lens, focalMm: number): number {
  return Math.min(lens.maxFocal, Math.max(lens.minFocal, focalMm));
}
