// 手ブレのモデル。手の震え（数Hzの揺れ）を正弦波の重ね合わせで表す。
// 係数は「1/焦点距離 秒より遅いとブレが目立ち始める」目安に合うよう調整している。

export interface ShakeOptions {
  stabilization: boolean;
  tripod: boolean;
}

/** 手ぶれ補正の効果（段） */
export const STABILIZATION_STOPS = 5;

interface Component {
  amp: number; // rad
  hz: number;
}

const COMPONENTS: Component[] = [
  { amp: 0.0025, hz: 1.5 },
  { amp: 0.0008, hz: 4.2 },
  { amp: 0.0003, hz: 9.0 },
];

export function shakeGain(opts: ShakeOptions): number {
  if (opts.tripod) return 0;
  return opts.stabilization ? 2 ** -STABILIZATION_STOPS : 1;
}

/** 撮影ごとに位相を変えた揺れの軌跡 [rad]（yaw, pitch）。補正の効果は含まない */
export function makeShakePath(seed: number): (timeSec: number) => [number, number] {
  let x = Math.floor(Math.abs(seed)) % 233280;
  const rand = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  const phases = COMPONENTS.map(() => [rand() * Math.PI * 2, rand() * Math.PI * 2]);
  return (t) => {
    let yaw = 0;
    let pitch = 0;
    COMPONENTS.forEach((c, i) => {
      yaw += c.amp * Math.sin(2 * Math.PI * c.hz * t + phases[i][0]);
      pitch += 0.8 * c.amp * Math.sin(2 * Math.PI * c.hz * t + phases[i][1]);
    });
    return [yaw, pitch];
  };
}

/** 露光時間中の揺れの大きさの目安 [rad]（角速度 × 時間、ただし振れ幅で頭打ち） */
export function expectedShakeAngle(exposureSec: number, opts: ShakeOptions): number {
  let total = 0;
  for (const c of COMPONENTS) {
    const omega = 2 * Math.PI * c.hz * c.amp;
    total += Math.min(omega * exposureSec, 2 * c.amp) ** 2;
  }
  return Math.sqrt(total) * shakeGain(opts);
}

/** 手ブレによるセンサー上のブレ幅 [mm] */
export function shakeBlurMm(focalMm: number, exposureSec: number, opts: ShakeOptions): number {
  return focalMm * expectedShakeAngle(exposureSec, opts);
}
