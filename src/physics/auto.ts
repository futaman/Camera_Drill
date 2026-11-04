// 撮影モード（A / S / P / オートISO）の露出の決め方。
// 測光した輝度 L から、露出計が補正値ちょうどを指す組み合わせを求める。

import { METER_K } from './exposure';

export type ShootingMode = 'M' | 'A' | 'S' | 'P';

export interface AutoInput {
  mode: ShootingMode;
  autoIso: boolean;
  /** 測光した輝度 [cd/m²] */
  luminance: number;
  /** 露出補正 [段] */
  comp: number;
  n: number;
  t: number;
  iso: number;
  /** レンズの開放F値と最小絞り */
  minN: number;
  maxN: number;
  /** オートISOがこれより遅くしないシャッター速度 [秒] */
  slowestT: number;
  minIso: number;
  maxIso: number;
}

export interface AutoResult {
  n: number;
  t: number;
  iso: number;
}

const T_MIN = 1 / 8000;
const T_MAX = 30;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * プログラムラインの絞り（APEX の Av）。明るいほど絞る。
 * EV15 で F9.5・1/360 秒、EV7 で F2.4・1/23 秒あたり。
 */
export function programAv(ev: number): number {
  return ev / 2 - 1;
}

export function solveExposure(a: AutoInput): AutoResult {
  // t·S/N² がこの値になれば、露出計が補正値を指す
  const x = (METER_K * 2 ** a.comp) / a.luminance;

  switch (a.mode) {
    case 'M': {
      if (!a.autoIso) return { n: a.n, t: a.t, iso: a.iso };
      return { n: a.n, t: a.t, iso: clamp((x * a.n * a.n) / a.t, a.minIso, a.maxIso) };
    }
    case 'A': {
      if (!a.autoIso) return { n: a.n, t: clamp((x * a.n * a.n) / a.iso, T_MIN, T_MAX), iso: a.iso };
      const iso = clamp((x * a.n * a.n) / a.slowestT, a.minIso, a.maxIso);
      return { n: a.n, t: clamp((x * a.n * a.n) / iso, T_MIN, T_MAX), iso };
    }
    case 'S': {
      if (!a.autoIso) return { n: clamp(Math.sqrt((a.t * a.iso) / x), a.minN, a.maxN), t: a.t, iso: a.iso };
      const iso = clamp((x * a.minN * a.minN) / a.t, a.minIso, a.maxIso);
      return { n: clamp(Math.sqrt((a.t * iso) / x), a.minN, a.maxN), t: a.t, iso };
    }
    case 'P': {
      // 感度を決めてから、EV を絞りとシャッターに振り分ける
      const pick = (iso: number): AutoResult => {
        const ev = Math.log2(iso / x); // N²/t = S/x
        const n = clamp(Math.SQRT2 ** programAv(ev), a.minN, a.maxN);
        return { n, t: clamp((x * n * n) / iso, T_MIN, T_MAX), iso };
      };
      if (!a.autoIso) return pick(a.iso);
      const base = pick(a.minIso);
      if (base.t <= a.slowestT) return base;
      const iso = clamp((x * base.n * base.n) / a.slowestT, a.minIso, a.maxIso);
      return { n: base.n, t: clamp((x * base.n * base.n) / iso, T_MIN, T_MAX), iso };
    }
  }
}
