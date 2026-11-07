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
  {
    id: 'prime-85',
    name: '85mm F1.4',
    minFocal: 85,
    maxFocal: 85,
    minFocusM: 0.85,
    maxAperture: () => 1.4,
  },
  {
    id: 'zoom-16-35',
    name: '16-35mm F4',
    minFocal: 16,
    maxFocal: 35,
    minFocusM: 0.28,
    maxAperture: () => 4,
  },
  {
    id: 'zoom-70-200',
    name: '70-200mm F2.8',
    minFocal: 70,
    maxFocal: 200,
    minFocusM: 1,
    maxAperture: () => 2.8,
  },
  {
    id: 'zoom-100-400',
    name: '100-400mm F4.5-5.6',
    minFocal: 100,
    maxFocal: 400,
    minFocusM: 1,
    // ズームすると開放F値が暗くなる
    maxAperture: (f) => 4.5 * (5.6 / 4.5) ** ((f - 100) / 300),
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
