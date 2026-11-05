// 薄肉レンズの光学。焦点距離とセンサー上の長さは mm、被写体などの距離は m で扱う。

export interface Sensor {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
}

export const FULL_FRAME: Sensor = { id: 'ff', name: 'フルサイズ', width: 36, height: 24 };

export function sensorDiagonal(s: Sensor): number {
  return Math.hypot(s.width, s.height);
}

/** 許容錯乱円（対角長 / 1500） */
export function permissibleCoc(s: Sensor): number {
  return sensorDiagonal(s) / 1500;
}

/** 画角 [度]。dimension にはセンサーの幅・高さ・対角のいずれかを渡す */
export function angleOfView(focalMm: number, dimensionMm: number): number {
  return (2 * Math.atan(dimensionMm / (2 * focalMm)) * 180) / Math.PI;
}

/** 有効口径 [mm] */
export function apertureDiameter(focalMm: number, n: number): number {
  return focalMm / n;
}

/**
 * センサー上の錯乱円の直径 [mm]（符号付き）。
 * 負はピント面より手前（前ボケ）、正は奥（後ボケ）。
 * 符号付きの値は距離に対して単調増加する。
 */
export function signedCoc(focalMm: number, n: number, focusM: number, objectM: number): number {
  const f = focalMm;
  const s = focusM * 1000;
  const d = objectM * 1000;
  return ((f * f) / (n * (s - f))) * ((d - s) / d);
}

export function coc(focalMm: number, n: number, focusM: number, objectM: number): number {
  return Math.abs(signedCoc(focalMm, n, focusM, objectM));
}

/** 無限遠の物体の錯乱円 [mm] */
export function cocAtInfinity(focalMm: number, n: number, focusM: number): number {
  const s = focusM * 1000;
  return (focalMm * focalMm) / (n * (s - focalMm));
}

/** センサー上の長さ [mm] を画像上のピクセル数に換算 */
export function mmToPx(mm: number, sensor: Sensor, imageWidthPx: number): number {
  return (mm / sensor.width) * imageWidthPx;
}

export interface DepthOfField {
  near: number; // m
  far: number; // m（Infinity あり）
  hyperfocal: number; // m
}

export function depthOfField(focalMm: number, n: number, focusM: number, cocMm: number): DepthOfField {
  const f = focalMm;
  const s = focusM * 1000;
  const h = (f * f) / (n * cocMm) + f;
  const near = (s * (h - f)) / (h + s - 2 * f);
  const far = s < h ? (s * (h - f)) / (h - s) : Infinity;
  return { near: near / 1000, far: far / 1000, hyperfocal: h / 1000 };
}
