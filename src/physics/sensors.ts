// カメラ本体のセンサーと、トリミング（クロップ）の計算。

import { FULL_FRAME, sensorDiagonal, type Sensor } from './optics';

export interface Body extends Sensor {
  megapixels: number;
}

export const BODIES: Body[] = [
  { ...FULL_FRAME, id: 'ff-24', name: 'フルサイズ 2400万画素', megapixels: 24 },
  { ...FULL_FRAME, id: 'ff-45', name: 'フルサイズ 4500万画素', megapixels: 45 },
  { id: 'apsc-24', name: 'APS-C 2400万画素', width: 23.5, height: 15.6, megapixels: 24 },
  { id: 'apsc-32', name: 'APS-C 3200万画素', width: 23.5, height: 15.6, megapixels: 32 },
  { id: 'm43-20', name: 'マイクロフォーサーズ 2000万画素', width: 17.3, height: 13, megapixels: 20 },
  { id: '1in-20', name: '1インチ 2000万画素', width: 13.2, height: 8.8, megapixels: 20 },
];

export function getBody(id: string): Body {
  return BODIES.find((b) => b.id === id) ?? BODIES[0];
}

/** 換算係数（フルサイズの対角長との比） */
export function cropFactor(s: Sensor): number {
  return sensorDiagonal(FULL_FRAME) / sensorDiagonal(s);
}

/** 35mm判換算の焦点距離 */
export function equivalentFocal(focalMm: number, s: Sensor): number {
  return focalMm * cropFactor(s);
}

/** 画素ピッチ [µm] */
export function pixelPitch(b: Body): number {
  return Math.sqrt((b.width * b.height) / (b.megapixels * 1e6)) * 1000;
}

/** 1mm あたりの画素数。同じレンズ・同じ距離なら、これが被写体に載る画素数を決める */
export function pixelsPerMm(b: Body): number {
  return 1000 / pixelPitch(b);
}

/** センサーの中央を倍率 crop でトリミングした、実質のセンサー */
export function croppedSensor(s: Sensor, crop: number): Sensor {
  if (crop === 1) return s;
  return { ...s, width: s.width / crop, height: s.height / crop };
}

/** トリミング後の画素数 [MP] */
export function croppedMegapixels(b: Body, crop: number): number {
  return b.megapixels / (crop * crop);
}

/** 同じ画角で撮るのに必要なトリミング倍率（to を基準に from を切り出す） */
export function cropToMatch(from: Sensor, to: Sensor): number {
  return from.width / to.width;
}
