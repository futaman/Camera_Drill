// 露出の計算。シーンは絶対輝度 L [cd/m²] で扱う。

/** 反射式露出計の較正定数 */
export const METER_K = 12.5;
/** 適正露出で測光値が写る明るさ（リニア） */
export const MIDDLE_GRAY = 0.18;
/** センサーが飽和するまでの、中間グレーからの余裕（ISO 12232 の飽和基準 78/10） */
export const HIGHLIGHT_HEADROOM_STOPS = Math.log2(78 / 10);
/** 飽和する正規化露光量 */
export const SATURATION = MIDDLE_GRAY * 2 ** HIGHLIGHT_HEADROOM_STOPS;

/**
 * 輝度 L に掛けると正規化露光量 v になる係数。
 * 測光した輝度がちょうど中間グレー (0.18) になるよう正規化している。
 */
export function exposureScale(t: number, iso: number, n: number): number {
  return (MIDDLE_GRAY * t * iso) / (METER_K * n * n);
}

/** 輝度 L [cd/m²] を ISO100 基準の EV に換算 */
export function ev100FromLuminance(l: number): number {
  return Math.log2((l * 100) / METER_K);
}

export function luminanceFromEv100(ev: number): number {
  return (METER_K * 2 ** ev) / 100;
}

/** 設定値が表す EV（ISO100 換算）。値が大きいほど暗く写る設定。 */
export function settingsEv100(n: number, t: number, iso: number): number {
  return Math.log2((n * n) / t) - Math.log2(iso / 100);
}

/** 測光した平均輝度に対して、何段明るく（+）/暗く（−）写るか */
export function exposureOffsetStops(meteredLuminance: number, t: number, iso: number, n: number): number {
  return Math.log2((meteredLuminance * t * iso) / (METER_K * n * n));
}
