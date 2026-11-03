// 1/3段刻みの標準的な目盛り。計算には厳密値（2の累乗）、表示には慣用の表記を使う。

export interface Stop {
  value: number;
  label: string;
}

const F_LABELS = [
  '1.0', '1.1', '1.2', '1.4', '1.6', '1.8', '2', '2.2', '2.5', '2.8', '3.2', '3.5', '4', '4.5',
  '5', '5.6', '6.3', '7.1', '8', '9', '10', '11', '13', '14', '16', '18', '20', '22',
];

const SS_LABELS = [
  '30"', '25"', '20"', '15"', '13"', '10"', '8"', '6"', '5"', '4"', '3.2"', '2.5"', '2"', '1.6"', '1.3"', '1"',
  '0.8"', '0.6"', '0.5"', '0.4"', '0.3"', '1/4',
  '1/5', '1/6', '1/8', '1/10', '1/13', '1/15', '1/20', '1/25', '1/30', '1/40', '1/50', '1/60', '1/80',
  '1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400', '1/500', '1/640', '1/800', '1/1000',
  '1/1250', '1/1600', '1/2000', '1/2500', '1/3200', '1/4000', '1/5000', '1/6400', '1/8000',
];

const ISO_LABELS = [
  '50', '64', '80', '100', '125', '160', '200', '250', '320', '400', '500', '640', '800', '1000', '1250',
  '1600', '2000', '2500', '3200', '4000', '5000', '6400', '8000', '10000', '12800', '16000', '20000',
  '25600', '32000', '40000', '51200',
];

/** F1.0 から F22 まで。F値は √2 倍で1段。 */
export const F_STOPS: Stop[] = F_LABELS.map((label, i) => ({ value: Math.SQRT2 ** (i / 3), label }));

/** 30秒（2^5）から 1/8000秒（2^-13）まで。 */
export const SS_STOPS: Stop[] = SS_LABELS.map((label, i) => ({ value: 2 ** ((15 - i) / 3), label }));

/** ISO 50 から 51200 まで。100 未満と 25600 超は拡張感度。 */
export const ISO_STOPS: Stop[] = ISO_LABELS.map((label, i) => ({ value: 100 * 2 ** ((i - 3) / 3), label }));

export const ISO_NATIVE_MIN = 100;
export const ISO_NATIVE_MAX = 25600;

/** value に最も近い目盛りの添字 */
export function nearestStopIndex(stops: Stop[], value: number): number {
  let best = 0;
  let bestDiff = Infinity;
  stops.forEach((s, i) => {
    const d = Math.abs(Math.log2(s.value / value));
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}

/** 段数の表示（例: +1 2/3） */
export function formatStops(stops: number): string {
  const thirds = Math.round(stops * 3);
  if (thirds === 0) return '±0';
  const sign = thirds > 0 ? '+' : '−';
  const abs = Math.abs(thirds);
  const whole = Math.floor(abs / 3);
  const frac = abs % 3;
  const fracLabel = frac === 0 ? '' : `${frac}/3`;
  if (whole === 0) return `${sign}${fracLabel}`;
  return `${sign}${whole}${fracLabel ? ' ' + fracLabel : ''}`;
}
