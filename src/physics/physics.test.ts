import { describe, expect, it } from 'vitest';
import {
  F_STOPS,
  ISO_STOPS,
  SS_STOPS,
  FULL_FRAME,
  MIDDLE_GRAY,
  SATURATION,
  angleOfView,
  coc,
  cocAtInfinity,
  depthOfField,
  ev100FromLuminance,
  exposureOffsetStops,
  exposureScale,
  expectedShakeAngle,
  formatStops,
  luminanceFromEv100,
  nearestStopIndex,
  permissibleCoc,
  saturationElectrons,
  settingsEv100,
  shakeBlurMm,
  signedCoc,
  snr,
} from '.';

const label = (stops: { label: string }[], i: number) => stops[i].label;

describe('目盛り', () => {
  it('F値の端と代表値', () => {
    expect(label(F_STOPS, 0)).toBe('1.0');
    expect(F_STOPS[F_STOPS.length - 1].label).toBe('22');
    expect(F_STOPS[nearestStopIndex(F_STOPS, 5.6)].label).toBe('5.6');
    expect(F_STOPS[nearestStopIndex(F_STOPS, 2.8)].label).toBe('2.8');
  });

  it('シャッタースピードの端と代表値', () => {
    expect(label(SS_STOPS, 0)).toBe('30"');
    expect(SS_STOPS[SS_STOPS.length - 1].label).toBe('1/8000');
    expect(SS_STOPS[nearestStopIndex(SS_STOPS, 1 / 125)].label).toBe('1/125');
    expect(SS_STOPS[nearestStopIndex(SS_STOPS, 1)].label).toBe('1"');
  });

  it('ISOの端と代表値', () => {
    expect(label(ISO_STOPS, 0)).toBe('50');
    expect(ISO_STOPS[ISO_STOPS.length - 1].label).toBe('51200');
    expect(ISO_STOPS[nearestStopIndex(ISO_STOPS, 100)].value).toBeCloseTo(100);
    expect(ISO_STOPS[nearestStopIndex(ISO_STOPS, 3200)].label).toBe('3200');
  });

  it('表記と厳密値のずれは1/6段未満', () => {
    const parseSs = (l: string) => (l.startsWith('1/') ? 1 / Number(l.slice(2)) : Number(l.replace('"', '')));
    for (const s of SS_STOPS) expect(Math.abs(Math.log2(s.value / parseSs(s.label)))).toBeLessThan(1 / 6);
    for (const s of F_STOPS) expect(Math.abs(Math.log2(s.value / Number(s.label)))).toBeLessThan(1 / 6);
    for (const s of ISO_STOPS) expect(Math.abs(Math.log2(s.value / Number(s.label)))).toBeLessThan(1 / 6);
  });

  it('段数の表記', () => {
    expect(formatStops(0)).toBe('±0');
    expect(formatStops(1)).toBe('+1');
    expect(formatStops(-2 / 3)).toBe('−2/3');
    expect(formatStops(5 / 3)).toBe('+1 2/3');
  });
});

describe('露出', () => {
  it('晴天のF16ルール: EV15 で F16・1/100・ISO100 がほぼ適正（経験則なので ±1/2段）', () => {
    const l = luminanceFromEv100(15);
    expect(Math.abs(exposureOffsetStops(l, 1 / 100, 100, 16))).toBeLessThan(0.5);
  });

  it('測光した輝度は中間グレーに写る', () => {
    const l = 50;
    const n = 4;
    const iso = 400;
    // N²/t = L·S/K を満たす t
    const t = (n * n * 12.5) / (l * iso);
    expect(l * exposureScale(t, iso, n)).toBeCloseTo(MIDDLE_GRAY);
  });

  it('F値・SS・ISOの1段は露光量の2倍', () => {
    const base = exposureScale(1 / 125, 100, 4);
    expect(exposureScale(1 / 125, 100, 4 / Math.SQRT2) / base).toBeCloseTo(2);
    expect(exposureScale(2 / 125, 100, 4) / base).toBeCloseTo(2);
    expect(exposureScale(1 / 125, 200, 4) / base).toBeCloseTo(2);
  });

  it('EV と輝度の相互変換', () => {
    expect(ev100FromLuminance(luminanceFromEv100(7))).toBeCloseTo(7);
    expect(settingsEv100(1, 1, 100)).toBeCloseTo(0);
    expect(settingsEv100(16, 1 / 128, 100)).toBeCloseTo(15);
  });

  it('白飛びまでの余裕は約3段', () => {
    expect(Math.log2(SATURATION / MIDDLE_GRAY)).toBeCloseTo(2.96, 2);
  });
});

describe('ボケ（錯乱円）', () => {
  it('ピント位置の錯乱円は0、前後で符号が逆', () => {
    expect(coc(50, 2, 2, 2)).toBeCloseTo(0);
    expect(signedCoc(50, 2, 2, 1)).toBeLessThan(0);
    expect(signedCoc(50, 2, 2, 5)).toBeGreaterThan(0);
  });

  it('距離に対して単調増加', () => {
    let prev = -Infinity;
    for (let d = 0.5; d < 50; d *= 1.3) {
      const c = signedCoc(85, 1.4, 3, d);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it('F値を1段絞ると錯乱円は 1/√2', () => {
    expect(coc(50, 2.8, 2, 10) / coc(50, 2, 2, 10)).toBeCloseTo(2 / 2.8, 5);
  });

  it('同じ構図（被写体を同じ大きさ）なら焦点距離が長いほど背景がボケる', () => {
    // 被写体の大きさは f/s に比例するので、f と s を同じ比率で変える
    const bg = (f: number, s: number) => cocAtInfinity(f, 2.8, s);
    expect(bg(85, 3.4)).toBeGreaterThan(bg(50, 2));
  });

  it('無限遠の錯乱円は遠い物体の極限', () => {
    expect(coc(50, 2, 2, 1e6)).toBeCloseTo(cocAtInfinity(50, 2, 2), 4);
  });

  it('被写界深度: 50mm F8 を3mに合わせると約2.36〜4.12m', () => {
    const dof = depthOfField(50, 8, 3, permissibleCoc(FULL_FRAME));
    expect(dof.near).toBeCloseTo(2.36, 2);
    expect(dof.far).toBeCloseTo(4.12, 2);
  });

  it('過焦点距離より遠くに合わせると奥は無限遠まで', () => {
    const dof = depthOfField(24, 11, 10, permissibleCoc(FULL_FRAME));
    expect(dof.far).toBe(Infinity);
  });
});

describe('画角', () => {
  it('50mm フルサイズの水平画角は約39.6度', () => {
    expect(angleOfView(50, FULL_FRAME.width)).toBeCloseTo(39.6, 1);
  });
});

describe('ノイズ', () => {
  it('ISOを2段上げると飽和電子数は1/4', () => {
    expect(saturationElectrons(400) / saturationElectrons(100)).toBeCloseTo(0.25);
  });

  it('同じ明るさに写すなら、ISOが高いほどSNRが低い', () => {
    expect(snr(MIDDLE_GRAY, 6400)).toBeLessThan(snr(MIDDLE_GRAY, 100));
  });

  it('同じISOでも暗い部分ほどSNRが低い', () => {
    expect(snr(0.01, 400)).toBeLessThan(snr(MIDDLE_GRAY, 400));
  });
});

describe('手ブレ', () => {
  const handheld = { stabilization: false, tripod: false };

  it('1/焦点距離 秒で許容錯乱円と同程度のブレ', () => {
    const blur = shakeBlurMm(50, 1 / 50, handheld);
    const c = permissibleCoc(FULL_FRAME);
    expect(blur / c).toBeGreaterThan(0.5);
    expect(blur / c).toBeLessThan(2);
  });

  it('シャッターが遅いほど・焦点距離が長いほどブレる', () => {
    expect(shakeBlurMm(50, 1 / 15, handheld)).toBeGreaterThan(shakeBlurMm(50, 1 / 250, handheld));
    expect(shakeBlurMm(200, 1 / 60, handheld)).toBeGreaterThan(shakeBlurMm(50, 1 / 60, handheld));
  });

  it('手ぶれ補正は5段分、三脚ならゼロ', () => {
    const t = 1 / 8;
    expect(expectedShakeAngle(t, { stabilization: true, tripod: false }) / expectedShakeAngle(t, handheld)).toBeCloseTo(1 / 32);
    expect(expectedShakeAngle(t, { stabilization: false, tripod: true })).toBe(0);
  });
});
