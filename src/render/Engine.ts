// 描画エンジン。3Dシーンを物理単位の輝度で描き、ブレ・ボケ・露出・ノイズ・現像を順に適用する。
//
//   シーン（cd/m²）→ サブフレームの蓄積（ブレ）→ 錯乱円の計算 → ボケ → 露出・ノイズ・白飛び → トーンカーブ
//
// ライブビューはサンプル数を抑えた軽量版、撮影（capture）は高品質版で同じ処理を行う。

import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import {
  FULL_FRAME,
  LOG_GRAY,
  LOG_SLOPE,
  METER_K,
  READ_NOISE,
  SATURATION,
  airyDiskMm,
  exposureScale,
  logEncode,
  makeShakePath,
  mmToPx,
  profileSaturation,
  saturationElectrons,
  shakeBlurMm,
  shakeGain,
  signedCoc,
  sphericalAmount,
  vignetteAmount,
  wellScale,
  type LensFx,
  type ProfileId,
  type Sensor,
} from '../physics';
import { getScene, type SceneDef, type SceneInstance } from '../scenes';
import {
  accumulateFrag,
  dofFrag,
  finalFrag,
  fullscreenVert,
  lensFrag,
  meterFrag,
  packFrag,
  tileDilateFrag,
  tileMaxFrag,
} from './shaders';

export type Quality = 'low' | 'standard' | 'high';
export type Metering = 'evaluative' | 'center' | 'spot';

export interface EngineSettings {
  n: number;
  t: number;
  iso: number;
  focal: number;
  /** トリミング後の実質のセンサー */
  sensor: Sensor;
  /** レンズの開放F値（収差の強さの基準） */
  maxApertureN: number;
  profile: ProfileId;
  lensFx: LensFx;
  metering: Metering;
  focusMode: 'af' | 'mf';
  focusM: number;
  minFocusM: number;
  /** AFポイント（0〜1、左上が原点） */
  afPoint: [number, number];
  stabilization: boolean;
  tripod: boolean;
  sceneId: string;
  lighting: string;
  params: Record<string, number>;
  zebra: boolean;
  noise: boolean;
  quality: Quality;
}

export interface Telemetry {
  /** 測光値に対して何段明るく写るか */
  meterStops: number;
  /** 測光した輝度 [cd/m²] */
  meteredLuminance: number;
  /** 輝度ヒストグラム（64区間、合計1） */
  histogram: number[];
  /** 白飛びしている画素の割合 */
  clippedRatio: number;
  /** 黒つぶれしている画素の割合 */
  crushedRatio: number;
  /** 実際のピント距離 [m] */
  focusM: number;
  /** 名前付きの位置までの距離（光軸方向）[m] */
  keyDistances: Record<string, number>;
  /** 手ブレ・被写体ブレの幅（横1000px換算） */
  shakePx: number;
  motionPx: number;
  subframes: number;
  fps: number;
}

const QUALITY = {
  low: { scale: 0.6, subframes: 4, budget: 64, shotSubframes: 32, shotBudget: 512 },
  standard: { scale: 1, subframes: 8, budget: 128, shotSubframes: 64, shotBudget: 1024 },
  high: { scale: 1.5, subframes: 16, budget: 256, shotSubframes: 96, shotBudget: 2048 },
} as const;

const TILE = 16;
const METER_SIZE = 32;
const HIST_W = 192;
const HIST_H = 128;
const MAX_RADIUS_FRACTION = 0.06;

function hdrTarget(w: number, h: number, opts: THREE.RenderTargetOptions = {}): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    ...opts,
  });
}

function shader(frag: string, uniforms: Record<string, THREE.IUniform>, blending = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...(blending
      ? {
          transparent: true,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
        }
      : {}),
  });
}

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(40, 1.5, 0.05, 1000);
  private quad = new FullScreenQuad();
  private raycaster = new THREE.Raycaster();

  private width = 1;
  private height = 1;
  private sceneRT!: THREE.WebGLRenderTarget;
  private accumRT!: THREE.WebGLRenderTarget;
  private packRT!: THREE.WebGLRenderTarget;
  private tileRT!: THREE.WebGLRenderTarget;
  private tileDilatedRT!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private lensRT!: THREE.WebGLRenderTarget;
  private meterRT: THREE.WebGLRenderTarget;
  private histRT: THREE.WebGLRenderTarget;
  private meterBuf = new Float32Array(METER_SIZE * METER_SIZE * 4);
  private histBuf = new Uint8Array(HIST_W * HIST_H * 4);

  private matAccum = shader(accumulateFrag, { tSrc: { value: null }, uWeight: { value: 1 } }, true);
  private matPack = shader(packFrag, {
    tColor: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.05 },
    uFar: { value: 40 },
    uFocal: { value: 50 },
    uN: { value: 2.8 },
    uFocus: { value: 2000 },
    uPxPerMm: { value: 1 },
    uMaxR: { value: 32 },
  });
  private matTileMax = shader(tileMaxFrag, { tPack: { value: null }, uTexel: { value: new THREE.Vector2() }, uTile: { value: TILE } });
  private matTileDilate = shader(tileDilateFrag, {
    tTile: { value: null },
    uTileTexel: { value: new THREE.Vector2() },
    uTile: { value: TILE },
    uReach: { value: 1 },
  });
  private matDof = shader(dofFrag, {
    tPack: { value: null },
    tTile: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uBudget: { value: 128 },
  });
  private matLens = shader(lensFrag, {
    tColor: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uAspect: { value: 1.5 },
    uCa: { value: 0 },
    uDist: { value: 0 },
    uVignette: { value: 0 },
    uSoftR: { value: 0 },
    uSoftMix: { value: 0 },
    uDiffR: { value: 0 },
  });
  private matMeter = shader(meterFrag, { tSrc: { value: null }, uCell: { value: new THREE.Vector2(1 / METER_SIZE, 1 / METER_SIZE) } });
  private matFinal = shader(finalFrag, {
    tColor: { value: null },
    uScale: { value: 1 },
    uSat: { value: SATURATION },
    uStdSat: { value: SATURATION },
    uProfile: { value: 0 },
    uLogGray: { value: LOG_GRAY },
    uLogSlope: { value: LOG_SLOPE },
    uWell: { value: 1000 },
    uRead: { value: READ_NOISE },
    uSeed: { value: 0 },
    uNoise: { value: 1 },
    uZebra: { value: 0 },
    uTime: { value: 0 },
  });

  private sceneDef: SceneDef | null = null;
  private sceneInst: SceneInstance | null = null;
  private settings: EngineSettings | null = null;
  private shakePath = makeShakePath(Date.now() % 100000);
  private focusM = 2;
  private raf = 0;
  private frame = 0;
  private lastFrameTime = 0;
  private fps = 0;
  private telemetry: Telemetry | null = null;
  private listeners = new Set<(t: Telemetry) => void>();
  private paused = false;
  private disposed = false;
  private shadowDirty = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 影は物が動くときと照明を変えたときだけ描き直す（屋外の大きな影の負荷を減らす）
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setPixelRatio(1);
    this.camera.filmGauge = FULL_FRAME.width;
    this.meterRT = new THREE.WebGLRenderTarget(METER_SIZE, METER_SIZE, { type: THREE.FloatType, depthBuffer: false });
    this.histRT = new THREE.WebGLRenderTarget(HIST_W, HIST_H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.allocate(canvas.width || 960, canvas.height || 640);
  }

  /** 表示サイズ（CSS px）に合わせて描画解像度を決める */
  resize(cssWidth: number, cssHeight: number): void {
    const q = QUALITY[this.settings?.quality ?? 'standard'];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = this.settings?.quality === 'high' ? dpr : q.scale;
    const w = Math.max(64, Math.round(cssWidth * scale));
    const h = Math.max(64, Math.round(cssHeight * scale));
    if (w === this.width && h === this.height) return;
    this.renderer.setSize(w, h, false);
    this.allocate(w, h);
  }

  private allocate(w: number, h: number): void {
    this.width = w;
    this.height = h;
    [this.sceneRT, this.accumRT, this.packRT, this.tileRT, this.tileDilatedRT, this.dofRT, this.lensRT].forEach((rt) =>
      rt?.dispose(),
    );
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.sceneRT = hdrTarget(w, h, { depthBuffer: true, depthTexture });
    this.accumRT = hdrTarget(w, h);
    this.packRT = hdrTarget(w, h);
    this.dofRT = hdrTarget(w, h);
    this.lensRT = hdrTarget(w, h);
    const tw = Math.ceil(w / TILE);
    const th = Math.ceil(h / TILE);
    const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.tileRT = hdrTarget(tw, th, nearest);
    this.tileDilatedRT = hdrTarget(tw, th, nearest);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setSettings(s: EngineSettings): void {
    const qualityChanged = this.settings?.quality !== s.quality;
    if (this.sceneDef?.id !== s.sceneId) {
      this.sceneInst?.dispose();
      this.sceneDef = getScene(s.sceneId);
      this.sceneInst = this.sceneDef.create();
    }
    if (this.settings?.lighting !== s.lighting || this.settings?.sceneId !== s.sceneId) {
      this.sceneInst!.setLighting(s.lighting);
      this.shadowDirty = true;
    }
    // ライトの位置はパラメータで変わるので、変わったら影を描き直す
    if (this.settings?.params !== s.params) this.shadowDirty = true;
    this.settings = s;
    if (s.focusMode === 'mf') this.focusM = Math.max(s.minFocusM, s.focusM);
    if (qualityChanged) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0) {
        this.width = 0;
        this.resize(rect.width, rect.height);
      }
    }
  }

  onTelemetry(cb: (t: Telemetry) => void): () => void {
    this.listeners.add(cb);
    if (this.telemetry) cb(this.telemetry);
    return () => this.listeners.delete(cb);
  }

  start(): void {
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      if (this.paused || !this.settings) return;
      if (this.lastFrameTime) {
        const dt = (now - this.lastFrameTime) / 1000;
        this.fps = this.fps * 0.9 + (1 / Math.max(dt, 1e-3)) * 0.1;
      }
      this.lastFrameTime = now;
      this.renderFrame(now / 1000, false);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** 高品質で1枚撮影し、JPEG の data URL を返す */
  async capture(): Promise<{ dataUrl: string; telemetry: Telemetry }> {
    this.paused = true;
    await new Promise((r) => requestAnimationFrame(r));
    if (this.disposed) throw new Error('エンジンは破棄されました');
    this.shakePath = makeShakePath(Math.floor(Math.random() * 100000));
    this.renderFrame(performance.now() / 1000, true);
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.92);
    this.paused = false;
    return { dataUrl, telemetry: this.telemetry! };
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.sceneInst?.dispose();
    [
      this.sceneRT,
      this.accumRT,
      this.packRT,
      this.tileRT,
      this.tileDilatedRT,
      this.dofRT,
      this.lensRT,
      this.meterRT,
      this.histRT,
    ].forEach((rt) => rt.dispose());
    [
      this.matAccum,
      this.matPack,
      this.matTileMax,
      this.matTileDilate,
      this.matDof,
      this.matLens,
      this.matMeter,
      this.matFinal,
    ].forEach((m) => m.dispose());
    this.quad.dispose();
    this.renderer.dispose();
    // ブラウザが同時に持てるコンテキスト数には上限があるので、すぐに解放する
    this.renderer.forceContextLoss();
  }

  private pass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = true): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    if (clear) this.renderer.clear();
    this.quad.render(this.renderer);
  }

  /** 揺れのない基準のカメラ姿勢 */
  private placeCamera(): void {
    const s = this.settings!;
    const pose = this.sceneInst!.cameraPose(s.params);
    this.camera.filmGauge = s.sensor.width;
    this.camera.setFocalLength(s.focal);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
    this.camera.updateMatrixWorld();
  }

  private autofocus(): void {
    const s = this.settings!;
    const ndc = new THREE.Vector2(s.afPoint[0] * 2 - 1, 1 - s.afPoint[1] * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.sceneInst!.focusTargets, true)[0];
    if (hit) this.focusM = Math.max(s.minFocusM, this.viewDepth(hit.point));
  }

  /** カメラの光軸方向の距離 [m] */
  private viewDepth(p: THREE.Vector3): number {
    return -p.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
  }

  private renderFrame(timeSec: number, shot: boolean): void {
    const s = this.settings!;
    const inst = this.sceneInst!;
    const q = QUALITY[s.quality];
    const { width: w, height: h } = this;
    const shakeOpts = { stabilization: s.stabilization, tripod: s.tripod };

    // ピント合わせと、名前付きの位置までの距離
    inst.update(s.params, timeSec);
    this.placeCamera();
    if (s.focusMode === 'af') this.autofocus();
    const keyDistances: Record<string, number> = {};
    for (const kp of inst.keyPoints(s.params, timeSec)) {
      const ndc = kp.position.clone().project(this.camera);
      if (Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1) keyDistances[kp.id] = this.viewDepth(kp.position);
    }

    // 露光時間中のブレの大きさから、サブフレーム数を決める
    const shakePx = mmToPx(shakeBlurMm(s.focal, s.t, shakeOpts), s.sensor, w);
    const motion = inst.motion(s.params);
    const motionPx = mmToPx((s.focal * motion.speed * s.t) / motion.distance, s.sensor, w);
    const maxSub = shot ? q.shotSubframes : q.subframes;
    const subframes = Math.min(maxSub, Math.max(1, Math.ceil(Math.max(shakePx, motionPx) / 1.5)));

    // サブフレームの描画と蓄積。深度をボケに使うため、露光の中央の瞬間を最後に描く
    const gain = shakeGain(shakeOpts);
    const [yaw0, pitch0] = this.shakePath(timeSec);
    const order = Array.from({ length: subframes }, (_, i) => i).sort(
      (a, b) => Math.abs(b - (subframes - 1) / 2) - Math.abs(a - (subframes - 1) / 2),
    );
    if (subframes > 1) {
      this.renderer.setRenderTarget(this.accumRT);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
    }
    for (const i of order) {
      const u = (i + 0.5) / subframes - 0.5;
      const tau = timeSec + u * s.t;
      inst.update(s.params, tau);
      this.placeCamera();
      if (gain > 0) {
        const [yaw, pitch] = this.shakePath(tau);
        this.camera.rotateY((yaw - yaw0) * gain);
        this.camera.rotateX((pitch - pitch0) * gain);
        this.camera.updateMatrixWorld();
      }
      this.renderer.setRenderTarget(this.sceneRT);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      if (this.shadowDirty || motion.speed > 0) {
        this.renderer.shadowMap.needsUpdate = true;
        this.shadowDirty = false;
      }
      this.renderer.render(inst.scene, this.camera);
      if (subframes > 1) {
        this.matAccum.uniforms.tSrc.value = this.sceneRT.texture;
        this.matAccum.uniforms.uWeight.value = 1 / subframes;
        this.pass(this.matAccum, this.accumRT, false);
      }
    }
    const color = subframes > 1 ? this.accumRT.texture : this.sceneRT.texture;

    // 錯乱円
    const pxPerMm = w / s.sensor.width;
    const range = inst.depthRange(s.params);
    const cocMax =
      Math.max(
        Math.abs(signedCoc(s.focal, s.n, this.focusM, range.near)),
        Math.abs(signedCoc(s.focal, s.n, this.focusM, range.far)),
      ) *
      pxPerMm *
      0.5;
    const maxR = Math.min(cocMax + 1, w * MAX_RADIUS_FRACTION);
    const pu = this.matPack.uniforms;
    pu.tColor.value = color;
    pu.tDepth.value = this.sceneRT.depthTexture;
    pu.uNear.value = this.camera.near;
    pu.uFar.value = this.camera.far;
    pu.uFocal.value = s.focal;
    pu.uN.value = s.n;
    pu.uFocus.value = this.focusM * 1000;
    pu.uPxPerMm.value = pxPerMm;
    pu.uMaxR.value = maxR;
    this.pass(this.matPack, this.packRT);

    // ボケ
    this.matTileMax.uniforms.tPack.value = this.packRT.texture;
    this.matTileMax.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.pass(this.matTileMax, this.tileRT);
    this.matTileDilate.uniforms.tTile.value = this.tileRT.texture;
    this.matTileDilate.uniforms.uTileTexel.value.set(1 / this.tileRT.width, 1 / this.tileRT.height);
    this.matTileDilate.uniforms.uReach.value = Math.min(8, Math.ceil(maxR / TILE) + 1);
    this.pass(this.matTileDilate, this.tileDilatedRT);
    const du = this.matDof.uniforms;
    du.tPack.value = this.packRT.texture;
    du.tTile.value = this.tileDilatedRT.texture;
    du.uTexel.value.set(1 / w, 1 / h);
    du.uBudget.value = shot ? q.shotBudget : q.budget;
    this.pass(this.matDof, this.dofRT);

    // 収差と回折
    const fx = s.lensFx;
    let developed = this.dofRT.texture;
    if (fx.chromatic > 0 || fx.distortion !== 0 || fx.vignette > 0 || fx.spherical > 0 || fx.diffraction > 0) {
      const lu = this.matLens.uniforms;
      lu.tColor.value = this.dofRT.texture;
      lu.uTexel.value.set(1 / w, 1 / h);
      lu.uAspect.value = w / h;
      lu.uCa.value = fx.chromatic * 0.008;
      lu.uDist.value = -fx.distortion * 0.35;
      lu.uVignette.value = Math.min(0.95, vignetteAmount(fx.vignette, s.n, s.maxApertureN));
      lu.uSoftR.value = w * 0.012;
      lu.uSoftMix.value = Math.min(0.85, sphericalAmount(fx.spherical, s.n, s.maxApertureN));
      lu.uDiffR.value = (airyDiskMm(s.n) / 2) * pxPerMm * fx.diffraction;
      this.pass(this.matLens, this.lensRT);
      developed = this.lensRT.texture;
    }

    // 露出・ノイズ・現像
    const fu = this.matFinal.uniforms;
    fu.tColor.value = developed;
    fu.uScale.value = exposureScale(s.t, s.iso, s.n);
    fu.uSat.value = profileSaturation(s.profile);
    fu.uProfile.value = s.profile === 'standard' ? 0 : s.profile === 'log' ? 1 : 2;
    fu.uWell.value = saturationElectrons(s.iso, s.sensor) * wellScale(s.profile);
    fu.uSeed.value = shot ? Math.random() * 1000 : this.frame % 97;
    fu.uNoise.value = s.noise ? 1 : 0;
    fu.uZebra.value = s.zebra && !shot ? 1 : 0;
    fu.uTime.value = timeSec;
    this.pass(this.matFinal, null);

    this.frame++;
    if (shot || this.frame % 6 === 1) {
      this.measure(color, s, { focusM: this.focusM, keyDistances, shakePx, motionPx, subframes, w });
    }
  }

  /** 測光とヒストグラム（GPU から読み戻す） */
  private measure(
    color: THREE.Texture,
    s: EngineSettings,
    info: { focusM: number; keyDistances: Record<string, number>; shakePx: number; motionPx: number; subframes: number; w: number },
  ): void {
    this.matMeter.uniforms.tSrc.value = color;
    this.pass(this.matMeter, this.meterRT);
    this.renderer.readRenderTargetPixels(this.meterRT, 0, 0, METER_SIZE, METER_SIZE, this.meterBuf);

    // 評価測光: 中央寄りの重みで、極端に明るい点（光源など）の影響を抑えて平均する
    // 中央重点: より中央に絞り、明るい点も抑えない
    // スポット: AFポイントのごく狭い範囲だけを測る
    let wSum = 0;
    let logSum = 0;
    const lum: number[] = [];
    const weights: number[] = [];
    for (let y = 0; y < METER_SIZE; y++) {
      for (let x = 0; x < METER_SIZE; x++) {
        const i = (y * METER_SIZE + x) * 4;
        const l = 0.2126 * this.meterBuf[i] + 0.7152 * this.meterBuf[i + 1] + 0.0722 * this.meterBuf[i + 2];
        const u = (x + 0.5) / METER_SIZE;
        const v = (y + 0.5) / METER_SIZE;
        let wgt: number;
        if (s.metering === 'spot') {
          const dx = u - s.afPoint[0];
          const dy = v - (1 - s.afPoint[1]);
          wgt = Math.exp(-(dx * dx + dy * dy) / 0.002);
        } else {
          const r2 = (u - 0.5) ** 2 + (v - 0.5) ** 2;
          wgt = Math.exp(-r2 / (s.metering === 'center' ? 0.02 : 0.04));
        }
        lum.push(l);
        weights.push(wgt);
        wSum += wgt;
        logSum += wgt * Math.log(l + 1e-4);
      }
    }
    const logAvg = Math.exp(logSum / wSum);
    let metered = 0;
    const cap = s.metering === 'evaluative' ? logAvg * 12 : Infinity;
    lum.forEach((l, i) => (metered += weights[i] * Math.min(l, cap)));
    metered /= wSum;

    // ヒストグラム: 仕上がり画像を縮小して集計
    this.pass(this.matFinal, this.histRT);
    this.renderer.readRenderTargetPixels(this.histRT, 0, 0, HIST_W, HIST_H, this.histBuf);
    const bins = new Array(64).fill(0);
    let clipped = 0;
    let crushed = 0;
    const total = HIST_W * HIST_H;
    // 白飛びとみなす表示値。Log の記録値は飽和しても 100% にならない
    const clipLevel = s.profile === 'log' ? logEncode(profileSaturation('log')) * 255 - 1 : s.profile === 'log-lut' ? 252 : 254;
    for (let i = 0; i < total; i++) {
      const r = this.histBuf[i * 4];
      const g = this.histBuf[i * 4 + 1];
      const b = this.histBuf[i * 4 + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      bins[Math.min(63, Math.floor(y / 4))]++;
      if (Math.max(r, g, b) >= clipLevel) clipped++;
      if (Math.max(r, g, b) <= 3) crushed++;
    }

    const scaleTo1000 = 1000 / info.w;
    this.telemetry = {
      meterStops: Math.log2((metered * s.t * s.iso) / (METER_K * s.n * s.n)),
      meteredLuminance: metered,
      histogram: bins.map((b) => b / total),
      clippedRatio: clipped / total,
      crushedRatio: crushed / total,
      focusM: info.focusM,
      keyDistances: info.keyDistances,
      shakePx: info.shakePx * scaleTo1000,
      motionPx: info.motionPx * scaleTo1000,
      subframes: info.subframes,
      fps: this.fps,
    };
    this.listeners.forEach((cb) => cb(this.telemetry!));
  }
}
