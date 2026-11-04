// ポストプロセス用のシェーダー。入力はすべてリニアな輝度 [cd/m²]。

export const fullscreenVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** サブフレームを重み付きで足し込む（加算ブレンドで使う） */
export const accumulateFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform float uWeight;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0);
}
`;

/**
 * 色と、深度から求めた符号付き錯乱円 [px] を1枚にまとめる。
 * 錯乱円は負が前ボケ、正が後ボケで、距離に対して単調増加する。
 */
export const packFrag = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocal;     // mm
uniform float uN;
uniform float uFocus;     // mm
uniform float uPxPerMm;   // センサー上の1mmが何ピクセルか
uniform float uMaxR;      // px
varying vec2 vUv;
void main() {
  float depth = texture2D(tDepth, vUv).x;
  float viewZ = perspectiveDepthToViewZ(depth, uNear, uFar);
  float d = -viewZ * 1000.0;
  float c = (uFocal * uFocal) / (uN * (uFocus - uFocal)) * (d - uFocus) / d;
  float px = clamp(c * uPxPerMm * 0.5, -uMaxR, uMaxR); // 直径 → 半径
  gl_FragColor = vec4(texture2D(tColor, vUv).rgb, px);
}
`;

/** タイルごとの最大ボケ半径 */
export const tileMaxFrag = /* glsl */ `
uniform sampler2D tPack;
uniform vec2 uTexel;
uniform float uTile;
varying vec2 vUv;
void main() {
  vec2 origin = (floor(vUv / (uTexel * uTile)) * uTile + 0.5) * uTexel;
  float m = 0.0;
  int n = int(uTile);
  for (int y = 0; y < n; y++) {
    for (int x = 0; x < n; x++) {
      m = max(m, abs(texture2D(tPack, origin + vec2(float(x), float(y)) * uTexel).a));
    }
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}
`;

/** 近くのタイルの大きなボケがはみ出してくる分を広げる */
export const tileDilateFrag = /* glsl */ `
uniform sampler2D tTile;
uniform vec2 uTileTexel;
uniform float uTile;
uniform float uReach; // 何タイル先まで見るか
varying vec2 vUv;
void main() {
  float m = texture2D(tTile, vUv).r;
  int r = int(uReach);
  for (int y = -r; y <= r; y++) {
    for (int x = -r; x <= r; x++) {
      vec2 o = vec2(float(x), float(y));
      float r = texture2D(tTile, vUv + o * uTileTexel).r;
      float dist = max(length(o) - 1.5, 0.0) * uTile;
      if (r >= dist) m = max(m, r);
    }
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}
`;

/**
 * ボケ。黄金角のらせん上でサンプルし、各サンプルの錯乱円が中心まで届くなら混ぜる
 * （scatter-as-gather）。奥のサンプルは手前のピントの合った物に被らないよう大きさを制限する。
 */
export const dofFrag = /* glsl */ `
uniform sampler2D tPack;
uniform sampler2D tTile;
uniform vec2 uTexel;
uniform float uBudget;
varying vec2 vUv;
const float GOLDEN_ANGLE = 2.39996323;
void main() {
  // ループ回数を uniform で決める（定数にするとコンパイラが展開して初回の読み込みが遅くなる）
  int maxSamples = int(uBudget) * 2 + 16;
  vec4 center = texture2D(tPack, vUv);
  float maxR = texture2D(tTile, vUv).r;
  if (maxR < 0.5) {
    gl_FragColor = vec4(center.rgb, 1.0);
    return;
  }
  float centerSize = abs(center.a);
  float radScale = max(0.5, maxR * maxR / (2.0 * uBudget));
  vec3 color = center.rgb;
  float tot = 1.0;
  float radius = radScale;
  float ang = 0.0;
  for (int i = 0; i < maxSamples; i++) {
    if (radius > maxR) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec4 s = texture2D(tPack, tc);
    float size = abs(s.a);
    if (s.a > center.a) size = clamp(size, 0.0, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, size);
    color += mix(color / tot, s.rgb, m);
    tot += 1.0;
    radius += radScale / radius;
    ang += GOLDEN_ANGLE;
  }
  gl_FragColor = vec4(color / tot, 1.0);
}
`;

/**
 * レンズの収差と回折。ボケの後、露出の前に、リニアな輝度のまま適用する。
 * 歪曲は uv の放射方向のずれ、倍率色収差は色ごとの拡大率の違いとして扱う。
 */
export const lensFrag = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uCa;        // 色ごとの拡大率の差
uniform float uDist;      // 正で樽型、負で糸巻き型
uniform float uVignette;  // 隅の減光量
uniform float uSoftR;     // 球面収差のにじみの半径 [px]
uniform float uSoftMix;   // にじみの混ざる割合
uniform float uDiffR;     // 回折のボケの半径 [px]
varying vec2 vUv;
const float GOLDEN_ANGLE = 2.39996323;

vec3 disk(vec2 uv, float radius) {
  vec3 sum = texture2D(tColor, uv).rgb;
  if (radius < 0.5) return sum;
  for (int i = 1; i < 16; i++) {
    float r = sqrt(float(i) / 15.0) * radius;
    float a = float(i) * GOLDEN_ANGLE;
    sum += texture2D(tColor, uv + vec2(cos(a), sin(a)) * uTexel * r).rgb;
  }
  return sum / 16.0;
}

vec3 lens(vec2 uv) {
  vec3 c = disk(uv, uDiffR);
  if (uSoftMix > 0.0) c = mix(c, disk(uv, uSoftR), uSoftMix);
  return c;
}

vec2 warp(vec2 p, float scale) {
  float r2 = dot(p, p);
  float corner = dot(vec2(uAspect, 1.0), vec2(uAspect, 1.0)) * 0.25;
  // 樽型では四隅が画面内に収まるよう全体を拡大する
  float norm = uDist > 0.0 ? 1.0 + uDist * corner : 1.0;
  vec2 q = p * (1.0 + uDist * r2) / norm * scale;
  return q / vec2(uAspect, 1.0) + 0.5;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 color;
  if (uCa > 0.0) {
    color = vec3(lens(warp(p, 1.0 - uCa)).r, lens(warp(p, 1.0)).g, lens(warp(p, 1.0 + uCa)).b);
  } else {
    color = lens(warp(p, 1.0));
  }
  float corner = dot(vec2(uAspect, 1.0), vec2(uAspect, 1.0)) * 0.25;
  float rn = dot(p, p) / corner;
  color *= 1.0 - uVignette * rn * rn;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** 測光用の縮小（各セルの平均輝度） */
export const meterFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uCell;
varying vec2 vUv;
void main() {
  vec3 sum = vec3(0.0);
  vec2 origin = vUv - uCell * 0.5;
  for (int y = 0; y < 6; y++) {
    for (int x = 0; x < 6; x++) {
      sum += texture2D(tSrc, origin + (vec2(float(x), float(y)) + 0.5) / 6.0 * uCell).rgb;
    }
  }
  gl_FragColor = vec4(sum / 36.0, 1.0);
}
`;

/**
 * センサーと現像: 露光量 → ノイズ → 飽和（白飛び）→ トーンカーブ → sRGB。
 * ノイズは集めた電子数のショットノイズと読み出しノイズ。
 */
export const finalFrag = /* glsl */ `
uniform sampler2D tColor;
uniform float uScale;     // 輝度 → 正規化露光量
uniform float uSat;       // 飽和する露光量
uniform float uStdSat;    // 標準プロファイルの飽和する露光量
uniform int uProfile;     // 0: 標準, 1: Log, 2: Log + LUT
uniform float uLogGray;
uniform float uLogSlope;
uniform float uWell;      // 飽和電子数
uniform float uRead;      // 読み出しノイズ [e-]
uniform float uSeed;
uniform float uNoise;
uniform float uZebra;
uniform float uTime;
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float gauss(vec2 p) {
  float u1 = max(hash12(p), 1e-6);
  float u2 = hash12(p + 17.31);
  return sqrt(-2.0 * log(u1)) * cos(6.2831853 * u2);
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 v = texture2D(tColor, vUv).rgb * uScale;
  bool clipped = max(v.r, max(v.g, v.b)) >= uSat;

  if (uNoise > 0.5) {
    vec2 p = gl_FragCoord.xy + uSeed * 131.7;
    float nl = gauss(p);
    vec3 nc = vec3(gauss(p + 3.1), gauss(p + 7.7), gauss(p + 11.3));
    vec3 e = max(v, 0.0) / uSat * uWell;
    vec3 sigma = sqrt(e + uRead * uRead);
    e += (0.8 * nl + 0.6 * nc) * sigma;
    v = e / uWell * uSat;
  }

  v = clamp(v, 0.0, uSat);
  vec3 y;
  if (uProfile == 1) {
    // Log の記録値をそのまま表示する（眠い絵になる）
    y = clamp(uLogGray + uLogSlope * log2(max(v, 1e-5) / 0.18), 0.04, 1.0);
  } else {
    vec3 x = v / uStdSat;
    if (uProfile == 2) {
      // 中間調は標準と同じにして、余ったハイライトをなだらかに収める
      vec3 over = max(x - 0.5, 0.0);
      x = min(x, vec3(0.5)) + 0.5 * (1.0 - exp(-over / 1.6));
    }
    y = toSrgb(pow(clamp(x, 0.0, 1.0), vec3(0.835)));
    y = mix(y, smoothstep(0.0, 1.0, y), 0.2);
  }

  if (uZebra > 0.5 && clipped) {
    float stripe = step(6.0, mod(gl_FragCoord.x + gl_FragCoord.y + uTime * 40.0, 12.0));
    y = mix(y, vec3(stripe), 0.7);
  }
  gl_FragColor = vec4(y, 1.0);
}
`;
