import { describe, expect, it } from 'vitest';
import {
  F_STOPS,
  ISO_STOPS,
  SS_STOPS,
  FULL_FRAME,
  MIDDLE_GRAY,
  SATURATION,
  airyDiskMm,
  angleOfView,
  coc,
  cropFactor,
  cropToMatch,
  croppedMegapixels,
  croppedSensor,
  equivalentFocal,
  getBody,
  logEncode,
  mmToPx,
  pixelsPerMm,
  profileSaturation,
  solveExposure,
  sphericalAmount,
  vignetteAmount,
  wellScale,
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

describe('センササイズ', () => {
  const apsc = getBody('apsc-24');
  const ff = getBody('ff-24');

  it('換算係数と換算焦点距離', () => {
    expect(cropFactor(ff)).toBeCloseTo(1);
    expect(cropFactor(apsc)).toBeCloseTo(1.53, 1);
    expect(equivalentFocal(33, apsc)).toBeCloseTo(50.6, 0);
  });

  it('同じ画角・同じF値なら、大きいセンサーのほうが背景がボケる（画像の幅に対する割合で比較）', () => {
    const blur = (body: typeof ff, focal: number) => mmToPx(cocAtInfinity(focal, 2.8, 3), body, 1000);
    expect(blur(ff, 50)).toBeGreaterThan(blur(apsc, 50 / cropFactor(apsc)));
  });

  it('同じレンズ・同じF値・同じ距離なら、APS-Cとフルサイズのトリミングは同じボケ', () => {
    const crop = cropToMatch(ff, apsc);
    const croppedFf = croppedSensor(ff, crop);
    const a = mmToPx(coc(200, 4, 10, 30), apsc, 1000);
    const b = mmToPx(coc(200, 4, 10, 30), croppedFf, 1000);
    expect(a).toBeCloseTo(b, 5);
  });

  it('同じ露出なら、APS-Cとフルサイズのトリミングは光の量もノイズも同じ', () => {
    const croppedFf = croppedSensor(ff, cropToMatch(ff, apsc));
    expect(snr(0.18, 800, apsc)).toBeCloseTo(snr(0.18, 800, croppedFf), 0); // 縦横比の差（0.4%）の分だけずれる
  });

  it('トリミングすると画素数は倍率の2乗で減る', () => {
    expect(croppedMegapixels(ff, 1.5)).toBeCloseTo(24 / 2.25);
  });

  it('被写体に載る画素数は画素ピッチで決まる', () => {
    expect(pixelsPerMm(apsc)).toBeGreaterThan(pixelsPerMm(ff));
    // 4500万画素のフルサイズは、2400万画素のAPS-Cより少し画素密度が低い
    expect(pixelsPerMm(getBody('ff-45')) / pixelsPerMm(apsc)).toBeCloseTo(0.89, 1);
  });
});

describe('撮影モード', () => {
  const base = {
    autoIso: false,
    luminance: 100,
    comp: 0,
    n: 4,
    t: 1 / 100,
    iso: 400,
    minN: 1.4,
    maxN: 22,
    slowestT: 1 / 60,
    minIso: 100,
    maxIso: 12800,
  };
  const offset = (r: { n: number; t: number; iso: number }, l = 100) => exposureOffsetStops(l, r.t, r.iso, r.n);

  it('Mモードはそのまま', () => {
    expect(solveExposure({ ...base, mode: 'M' })).toMatchObject({ n: 4, t: 1 / 100, iso: 400 });
  });

  it('A: F値はそのままで、SSが適正露出になる', () => {
    const r = solveExposure({ ...base, mode: 'A' });
    expect(r.n).toBe(4);
    expect(offset(r)).toBeCloseTo(0);
  });

  it('S: SSはそのままで、F値が適正露出になる', () => {
    const r = solveExposure({ ...base, mode: 'S' });
    expect(r.t).toBe(1 / 100);
    expect(offset(r)).toBeCloseTo(0);
  });

  it('P: 明るいほど絞って速いシャッターになる', () => {
    const bright = solveExposure({ ...base, mode: 'P', iso: 100, luminance: luminanceFromEv100(15) });
    const dark = solveExposure({ ...base, mode: 'P', iso: 100, luminance: luminanceFromEv100(7) });
    expect(bright.n).toBeGreaterThan(dark.n);
    expect(bright.t).toBeLessThan(dark.t);
    expect(bright.n).toBeCloseTo(9.5, 0);
  });

  it('露出補正の分だけ明るくなる', () => {
    const r = solveExposure({ ...base, mode: 'A', comp: 1 });
    expect(offset(r)).toBeCloseTo(1);
  });

  it('範囲外では値が頭打ちになり、露出が足りなくなる', () => {
    const r = solveExposure({ ...base, mode: 'S', t: 1 / 8000, iso: 100, luminance: 1 });
    expect(r.n).toBe(1.4);
    expect(offset(r, 1)).toBeLessThan(-5);
  });

  it('オートISO: Aモードで暗いと、SSの下限を守ってISOを上げる', () => {
    const l = luminanceFromEv100(3);
    const r = solveExposure({ ...base, mode: 'A', autoIso: true, n: 2.8, luminance: l });
    expect(r.t).toBeCloseTo(1 / 60);
    expect(r.iso).toBeGreaterThan(400);
    expect(offset(r, l)).toBeCloseTo(0);
  });

  it('オートISO: 明るければ最低ISOのまま', () => {
    const l = luminanceFromEv100(13);
    const r = solveExposure({ ...base, mode: 'A', autoIso: true, n: 2.8, luminance: l });
    expect(r.iso).toBe(100);
    expect(offset(r, l)).toBeCloseTo(0);
  });
});

describe('Log', () => {
  it('Logは標準より約3段ハイライトに余裕がある', () => {
    expect(Math.log2(profileSaturation('log') / profileSaturation('standard'))).toBeCloseTo(3, 0);
  });

  it('同じ光なら電子数は同じなので、同じ明るさのノイズは同じ', () => {
    const electrons = (id: 'standard' | 'log', iso: number) =>
      (0.18 / profileSaturation(id)) * saturationElectrons(iso) * wellScale(id);
    expect(electrons('log', 800)).toBeCloseTo(electrons('standard', 800));
  });

  it('記録値: 中間グレーは41%で、明るいほど大きい', () => {
    expect(logEncode(0.18)).toBeCloseTo(0.41);
    expect(logEncode(0.36)).toBeGreaterThan(logEncode(0.18));
    expect(logEncode(profileSaturation('log'))).toBeLessThan(1);
  });
});

describe('収差と回折', () => {
  it('回折のボケはF値に比例する', () => {
    expect(airyDiskMm(16) / airyDiskMm(8)).toBeCloseTo(2);
    expect(airyDiskMm(8)).toBeCloseTo(0.0107, 3);
  });

  it('絞ると球面収差と周辺減光は減る', () => {
    expect(sphericalAmount(1, 2.8, 1.4)).toBeLessThan(sphericalAmount(1, 1.4, 1.4));
    expect(vignetteAmount(1, 5.6, 1.4)).toBeLessThan(vignetteAmount(1, 1.4, 1.4));
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
