// 階調の記録方法（ピクチャープロファイル）。
// Log はゲインを下げて、ハイライトの余裕を増やす代わりに最低ISOが上がる。

import { HIGHLIGHT_HEADROOM_STOPS, MIDDLE_GRAY } from './exposure';

export type ProfileId = 'standard' | 'log' | 'log-lut';

export interface Profile {
  id: ProfileId;
  name: string;
  /** 中間グレーから白飛びまでの余裕 [段] */
  headroomStops: number;
  /** 選べる最低ISO */
  minIso: number;
}

/** Log のハイライトの余裕 [段] */
export const LOG_HEADROOM_STOPS = 6;
/** Log の最低ISO（センサーの基準感度のまま、3段分の余裕を確保する） */
export const LOG_MIN_ISO = 800;
/** Log の中間グレーの記録値 */
export const LOG_GRAY = 0.41;
/** Log の1段あたりの記録値の変化 */
export const LOG_SLOPE = 0.075;

export const PROFILES: Profile[] = [
  { id: 'standard', name: '標準', headroomStops: HIGHLIGHT_HEADROOM_STOPS, minIso: 100 },
  { id: 'log', name: 'Log（撮ったまま）', headroomStops: LOG_HEADROOM_STOPS, minIso: LOG_MIN_ISO },
  { id: 'log-lut', name: 'Log + 仕上げ（LUT）', headroomStops: LOG_HEADROOM_STOPS, minIso: LOG_MIN_ISO },
];

export function getProfile(id: ProfileId): Profile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

/** 白飛びする正規化露光量 */
export function profileSaturation(id: ProfileId): number {
  return MIDDLE_GRAY * 2 ** getProfile(id).headroomStops;
}

/** 飽和電子数の倍率。同じ光なら同じ電子数になるよう、余裕の分だけ大きくする */
export function wellScale(id: ProfileId): number {
  return 2 ** (getProfile(id).headroomStops - HIGHLIGHT_HEADROOM_STOPS);
}

/** Log の記録値（0〜1）。正規化露光量 v から求める */
export function logEncode(v: number): number {
  return Math.min(1, Math.max(0, LOG_GRAY + LOG_SLOPE * Math.log2(Math.max(v, 1e-6) / MIDDLE_GRAY)));
}
