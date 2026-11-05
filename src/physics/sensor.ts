// センサーのノイズモデル。出力画像の1ピクセルあたりに集まる電子数で考える。

import { SATURATION } from './exposure';
import { FULL_FRAME, type Sensor } from './optics';

/** ISO100・フルサイズで、出力1ピクセルが飽和するまでに集める電子数 */
export const FULL_WELL_BASE = 60000;
/** 読み出しノイズ [e⁻] */
export const READ_NOISE = 3;

/**
 * ISO とセンササイズから、出力1ピクセルの飽和電子数を求める。
 * ISO を上げる = 少ない光で飽和させる = 集める電子が少ない。
 */
export function saturationElectrons(iso: number, sensor: Sensor = FULL_FRAME): number {
  const areaRatio = (sensor.width * sensor.height) / (FULL_FRAME.width * FULL_FRAME.height);
  return FULL_WELL_BASE * (100 / iso) * areaRatio;
}

/** 正規化露光量 v の部分の SNR（信号 / ノイズ） */
export function snr(v: number, iso: number, sensor: Sensor = FULL_FRAME): number {
  const electrons = (v / SATURATION) * saturationElectrons(iso, sensor);
  return electrons / Math.sqrt(electrons + READ_NOISE * READ_NOISE);
}
