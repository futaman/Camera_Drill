// レンズの収差と回折。強さは 0〜1 の設定値で、画面の大きさに対する割合として扱う。

/** 緑の光の波長 [mm] */
const WAVELENGTH_MM = 0.00055;

export interface LensFx {
  /** 倍率色収差 */
  chromatic: number;
  /** 歪曲（負で樽型、正で糸巻き型） */
  distortion: number;
  /** 周辺減光 */
  vignette: number;
  /** 球面収差（開放付近のにじみ） */
  spherical: number;
  /** 回折を見やすく拡大する倍率。0 で無効 */
  diffraction: number;
}

export const NO_FX: LensFx = { chromatic: 0, distortion: 0, vignette: 0, spherical: 0, diffraction: 0 };

/** 回折によるボケ（エアリーディスク）の直径 [mm] */
export function airyDiskMm(n: number): number {
  return 2.44 * WAVELENGTH_MM * n;
}

/** 球面収差のにじみの強さ。絞るとすばやく消える（開放からの段数の3乗に効く） */
export function sphericalAmount(strength: number, n: number, maxApertureN: number): number {
  return strength * (maxApertureN / n) ** 3;
}

/** 周辺減光の隅での減光量 [0〜1]。絞ると改善する */
export function vignetteAmount(strength: number, n: number, maxApertureN: number): number {
  return strength * (maxApertureN / n) ** 1.5;
}
