// スタジオの光の計算。被写体は原点で、正面は +z（カメラ側）。
// 方位角は 0 がカメラ側、+90 が右、180 が被写体の真後ろ。距離は m、光度は cd、照度は lx。

export type ReflectorKind = 0 | 1 | 2 | 3;

/** レフ板の種類（0: なし、1: 白、2: 銀、3: 黒）の反射率 */
export const REFLECTANCE = [0, 0.75, 0.95, 0.04];
/** レフ板の面積 [m²] */
export const REFLECTOR_AREA = 1;
/** 明るさ 0 段のキーライトの光度 [cd]（2m で 2000lx） */
export const KEY_BASE_CD = 8000;
/** 部屋の壁などから回ってくる環境光 [lx] */
export const STUDIO_AMBIENT_LX = 40;
/** 黒レフが環境光を遮る割合 */
export const BLACK_FLAG_AMBIENT = 0.35;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 方位角・仰角・距離から位置を求める */
export function polar(azimuthDeg: number, elevationDeg: number, distance: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return {
    x: Math.sin(az) * Math.cos(el) * distance,
    y: Math.sin(el) * distance,
    z: Math.cos(az) * Math.cos(el) * distance,
  };
}

export function keyIntensity(powerStops: number): number {
  return KEY_BASE_CD * 2 ** powerStops;
}

/** 逆二乗の法則: 距離 d の照度 */
export function illuminance(intensityCd: number, distance: number): number {
  return intensityCd / (distance * distance);
}

/**
 * レフ板が被写体に返す光の照度 [lx]。
 * キーライトで照らされたレフ板を、反射率と面積で決まる光源とみなす。
 * キーライトがレフ板の表側を照らしていなければ何も返らない。
 */
export function reflectorIlluminance(
  kind: ReflectorKind,
  reflectorAzimuth: number,
  reflectorDistance: number,
  keyPos: Vec3,
  keyCd: number,
): number {
  if (kind === 0) return 0;
  const r = polar(reflectorAzimuth, 0, reflectorDistance);
  const dx = keyPos.x - r.x;
  const dy = keyPos.y - r.y;
  const dz = keyPos.z - r.z;
  const d = Math.hypot(dx, dy, dz);
  // レフ板は被写体（原点）を向く
  const cos = -(dx * r.x + dy * r.y + dz * r.z) / (d * reflectorDistance);
  if (cos <= 0) return 0;
  const onBoard = (keyCd / (d * d)) * cos;
  const luminance = (onBoard * REFLECTANCE[kind]) / Math.PI;
  return illuminance(luminance * REFLECTOR_AREA, reflectorDistance);
}

export interface StudioLightSetup {
  keyAzimuth: number;
  keyElevation: number;
  keyDistance: number;
  keyPower: number;
  /** フィルライトの強さ（キーライトの光度に対する割合） */
  fill: number;
  reflector: ReflectorKind;
  reflectorAzimuth: number;
  reflectorDistance: number;
}

export interface LightingBalance {
  /** キーライトだけの照度 [lx] */
  keyLx: number;
  /** 影の側に届く照度 [lx]（環境光 + フィル + レフ板） */
  fillLx: number;
  reflectorLx: number;
  /** 光の当たる側と影の側の明るさの差 [段] */
  ratioStops: number;
}

export function lightingBalance(s: StudioLightSetup): LightingBalance {
  const keyCd = keyIntensity(s.keyPower);
  const keyPos = polar(s.keyAzimuth, s.keyElevation, s.keyDistance);
  const keyLx = illuminance(keyCd, s.keyDistance);
  const reflectorLx = reflectorIlluminance(s.reflector, s.reflectorAzimuth, s.reflectorDistance, keyPos, keyCd);
  const ambient = STUDIO_AMBIENT_LX * (s.reflector === 3 ? BLACK_FLAG_AMBIENT : 1);
  const fillLx = ambient + illuminance(keyCd * s.fill, 2.5) + reflectorLx;
  return { keyLx, fillLx, reflectorLx, ratioStops: Math.log2((keyLx + fillLx) / fillLx) };
}
