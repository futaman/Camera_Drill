// S4 スタジオ: ライトの向き・距離・大きさとレフ板を自由に変えて、光の当て方を学ぶ。
// 大きな光源は、少しずつ位置をずらした複数のライトで近似する（影の縁がなだらかになる）。
// カメラは +z 側から -z 方向を向く。被写体は原点の台の上。ストロボではなく定常光として扱う。

import * as THREE from 'three';
import {
  BLACK_FLAG_AMBIENT,
  REFLECTANCE,
  REFLECTOR_AREA,
  STUDIO_AMBIENT_LX,
  keyIntensity,
  polar,
  type ReflectorKind,
} from '../physics';
import { createBust, createSolid, shadowed } from './plaster';
import type { SceneDef, SceneInstance } from './types';

/** 被写体の高さ [m]（ライトの基準点） */
const SUBJECT_Y = 1.45;
const BACKDROP_Z = -3;
const KEY_SAMPLES = 6;
const BG_COLORS = ['#7a7a7a', '#e8e8e8', '#141414'];

function create(): SceneInstance {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];

  // 背景紙（床から壁へつながる）
  const paperMat = new THREE.MeshStandardMaterial({ color: BG_COLORS[0], roughness: 0.95 });
  disposables.push(paperMat);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), paperMat);
  wall.position.set(0, 3.5, BACKDROP_Z);
  wall.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), paperMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = BACKDROP_Z + 7;
  floor.receiveShadow = true;
  scene.add(wall, floor);

  // 被写体
  const standMat = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.7 });
  disposables.push(standMat);
  const stand = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), standMat));
  stand.position.y = 0.45;
  const bust = createBust();
  bust.position.y = 0.9;
  const solids = new THREE.Group();
  const sphere = createSolid('sphere', 1.5);
  sphere.position.set(-0.17, 1.12, 0);
  const cube = createSolid('cube', 1.1);
  cube.position.set(0.15, 1.12, 0.02);
  const cone = createSolid('cone', 0.9);
  cone.position.set(0.15, 1.296, 0.02);
  const riser = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.34), standMat));
  riser.position.y = 1.01;
  solids.add(riser, sphere, cube, cone);
  scene.add(stand, bust, solids);

  // キーライト（複数のスポットで面光源を近似）
  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(0, SUBJECT_Y, 0);
  scene.add(keyTarget);
  const keys = Array.from({ length: KEY_SAMPLES }, () => {
    const l = new THREE.SpotLight('#fff', 1, 0, 1.15, 1, 2);
    l.target = keyTarget;
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.02;
    l.shadow.camera.near = 0.3;
    l.shadow.camera.far = 14;
    scene.add(l);
    return l;
  });
  // 光源の見た目（ソフトボックス）
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color('#fff'), side: THREE.DoubleSide });
  const box = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), boxMat);
  scene.add(box);
  disposables.push(boxMat);

  // フィル・リム・背景のライト
  const fillTarget = new THREE.Object3D();
  fillTarget.position.copy(keyTarget.position);
  const fillLight = new THREE.SpotLight('#fff', 0, 0, 0.8, 0.8, 2);
  fillLight.target = fillTarget;
  const rimLight = new THREE.SpotLight('#fff', 0, 0, 0.5, 0.6, 2);
  rimLight.target = fillTarget;
  const bgTarget = new THREE.Object3D();
  bgTarget.position.set(0, 1.5, BACKDROP_Z);
  const bgLight = new THREE.SpotLight('#fff', 0, 0, 0.9, 0.9, 2);
  bgLight.target = bgTarget;
  bgLight.position.set(0, 0.4, BACKDROP_Z + 1.2);
  scene.add(fillTarget, fillLight, rimLight, bgTarget, bgLight);

  // レフ板（キーライトの光を受けて被写体へ返す、大きな弱い光源）
  const boardMat = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.6, side: THREE.DoubleSide });
  const board = new THREE.Mesh(new THREE.CircleGeometry(Math.sqrt(REFLECTOR_AREA / Math.PI), 32), boardMat);
  disposables.push(boardMat);
  scene.add(board);
  const bounce = new THREE.SpotLight('#fff', 0, 0, 1.0, 1, 2);
  bounce.target = fillTarget;
  scene.add(bounce);

  const ambient = new THREE.AmbientLight('#fff', STUDIO_AMBIENT_LX);
  scene.add(ambient);

  const v = new THREE.Vector3();
  const u = new THREE.Vector3();
  const w = new THREE.Vector3();
  let applied = '';

  const apply = (p: Record<string, number>) => {
    const key = JSON.stringify(p);
    if (key === applied) return;
    applied = key;

    // キーライト
    const pos = polar(p.keyAz, p.keyEl, p.keyDist);
    const cd = keyIntensity(p.keyPower);
    v.set(pos.x, pos.y + SUBJECT_Y, pos.z);
    // 光軸に垂直な面の2軸
    w.copy(keyTarget.position).sub(v).normalize();
    u.set(0, 1, 0).cross(w).normalize();
    const u2 = new THREE.Vector3().crossVectors(w, u);
    const radius = p.keySize / 2;
    keys.forEach((l, i) => {
      const a = (i / (KEY_SAMPLES - 1)) * Math.PI * 2;
      const r = i === KEY_SAMPLES - 1 ? 0 : radius * 0.8;
      l.position.copy(v).addScaledVector(u, Math.cos(a) * r).addScaledVector(u2, Math.sin(a) * r);
      l.intensity = cd / KEY_SAMPLES;
    });
    box.position.copy(v);
    box.lookAt(keyTarget.position);
    box.scale.setScalar(Math.max(p.keySize, 0.06));
    // 発光面の輝度 = 光度 / 面積
    boxMat.emissiveIntensity = Math.min(50000, cd / (Math.PI * (Math.max(p.keySize, 0.06) / 2) ** 2));

    // フィル: キーと反対側の浅い角度
    const fillPos = polar(p.keyAz >= 0 ? -40 : 40, 15, 2.5);
    fillLight.position.set(fillPos.x, fillPos.y + SUBJECT_Y, fillPos.z);
    fillLight.intensity = cd * p.fill;

    // リム: キーと同じ側の斜め後ろ上
    const rimPos = polar(p.keyAz >= 0 ? 145 : -145, 45, 2.5);
    rimLight.position.set(rimPos.x, rimPos.y + SUBJECT_Y, rimPos.z);
    rimLight.intensity = cd * p.rim;

    bgLight.intensity = cd * p.bg * 0.25;
    paperMat.color.set(BG_COLORS[p.backdrop] ?? BG_COLORS[0]);

    // レフ板
    const kind = p.reflector as ReflectorKind;
    board.visible = kind !== 0;
    const rp = polar(p.reflAz, 0, p.reflDist);
    board.position.set(rp.x, SUBJECT_Y, rp.z);
    board.lookAt(keyTarget.position);
    boardMat.color.set(kind === 3 ? '#050505' : kind === 2 ? '#d8dde2' : '#f2f2f2');
    bounce.position.copy(board.position);
    // キーの光を受けた板の輝度から、板の光度を求める
    const dx = v.x - board.position.x;
    const dy = v.y - board.position.y;
    const dz = v.z - board.position.z;
    const d = Math.hypot(dx, dy, dz);
    const cos = -(dx * rp.x + dz * rp.z) / (d * p.reflDist);
    const onBoard = cos > 0 ? (cd / (d * d)) * cos : 0;
    bounce.intensity = kind === 0 ? 0 : (onBoard * REFLECTANCE[kind] * REFLECTOR_AREA) / Math.PI;

    ambient.intensity = STUDIO_AMBIENT_LX * (kind === 3 ? BLACK_FLAG_AMBIENT : 1);

    // 被写体
    bust.visible = p.subject === 0;
    solids.visible = p.subject === 1;
    bust.rotation.y = (p.subjectAz * Math.PI) / 180;
  };

  return {
    scene,
    focusTargets: [bust, solids, stand, wall, floor],
    setLighting() {},
    update(params) {
      apply(params);
    },
    cameraPose(params) {
      return { position: new THREE.Vector3(0, 1.5, params.distance), target: new THREE.Vector3(0, 1.4, 0) };
    },
    keyPoints() {
      return [
        { id: 'subject', label: '被写体', position: new THREE.Vector3(0, SUBJECT_Y, 0.1) },
        { id: 'background', label: '背景紙', position: new THREE.Vector3(0, 1.5, BACKDROP_Z) },
      ];
    },
    motion() {
      return { speed: 0, distance: 1 };
    },
    depthRange(params) {
      return { near: Math.max(0.3, params.distance - 0.4), far: params.distance - BACKDROP_Z + 1 };
    },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}

export const studio: SceneDef = {
  id: 'studio',
  name: 'スタジオ（ライティング）',
  description: 'キーライト・フィル・リム・背景ライトとレフ板を自由に動かして、光の当て方を試す。',
  lighting: [{ id: 'studio', label: 'スタジオ照明' }],
  params: [
    { id: 'keyAz', label: 'キーライトの向き（0: カメラ側 / ±90: 真横 / ±180: 真後ろ）', min: -180, max: 180, step: 5, default: -45, unit: '°' },
    { id: 'keyEl', label: 'キーライトの高さ', min: -20, max: 80, step: 5, default: 30, unit: '°' },
    { id: 'keyDist', label: 'キーライトの距離', min: 0.8, max: 5, step: 0.1, default: 2, unit: 'm' },
    { id: 'keySize', label: 'キーライトの大きさ（小さいほど硬い光）', min: 0.02, max: 2, step: 0.02, default: 0.8, unit: 'm' },
    { id: 'keyPower', label: 'キーライトの明るさ', min: -4, max: 4, step: 1 / 3, default: 0, unit: '段' },
    { id: 'fill', label: 'フィルライト（キーに対する強さ）', min: 0, max: 1, step: 0.05, default: 0, unit: '' },
    { id: 'rim', label: 'リムライト（後ろから縁を照らす）', min: 0, max: 2, step: 0.1, default: 0, unit: '' },
    { id: 'bg', label: '背景ライト', min: 0, max: 2, step: 0.1, default: 0, unit: '' },
    {
      id: 'reflector',
      label: 'レフ板',
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      unit: '',
      options: [
        { value: 0, label: 'なし' },
        { value: 1, label: '白（やわらかく返す）' },
        { value: 2, label: '銀（強く返す）' },
        { value: 3, label: '黒（光を吸って影を締める）' },
      ],
    },
    { id: 'reflAz', label: 'レフ板の向き', min: -180, max: 180, step: 5, default: 70, unit: '°' },
    { id: 'reflDist', label: 'レフ板の距離', min: 0.5, max: 2.5, step: 0.05, default: 0.9, unit: 'm' },
    {
      id: 'subject',
      label: '被写体',
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      unit: '',
      options: [
        { value: 0, label: '胸像' },
        { value: 1, label: '球・立方体・円すい' },
      ],
    },
    { id: 'subjectAz', label: '被写体の向き', min: -90, max: 90, step: 5, default: 0, unit: '°' },
    {
      id: 'backdrop',
      label: '背景紙',
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      unit: '',
      options: [
        { value: 0, label: 'グレー' },
        { value: 1, label: '白' },
        { value: 2, label: '黒' },
      ],
    },
    { id: 'distance', label: '被写体までの距離', min: 1.2, max: 6, step: 0.1, default: 3.4, unit: 'm' },
  ],
  presets: [
    { id: 'rembrandt', label: 'レンブラント', params: { keyAz: -45, keyEl: 40, keyDist: 2, keySize: 0.8, fill: 0, rim: 0, bg: 0, reflector: 0, backdrop: 0 } },
    { id: 'loop', label: 'ループ', params: { keyAz: -30, keyEl: 30, keyDist: 2, keySize: 0.8, fill: 0.05, rim: 0, bg: 0, reflector: 1, reflAz: 60, reflDist: 0.9, backdrop: 0 } },
    { id: 'butterfly', label: 'バタフライ', params: { keyAz: 0, keyEl: 50, keyDist: 1.8, keySize: 0.6, fill: 0.1, rim: 0, bg: 0.3, reflector: 0, backdrop: 0 } },
    { id: 'split', label: 'スプリット', params: { keyAz: -90, keyEl: 5, keyDist: 1.8, keySize: 0.4, fill: 0, rim: 0, bg: 0, reflector: 0, backdrop: 2 } },
    { id: 'rim', label: 'リムライト', params: { keyAz: -150, keyEl: 35, keyDist: 2, keySize: 0.4, fill: 0.02, rim: 1, bg: 0, reflector: 2, reflAz: 65, reflDist: 1, backdrop: 2 } },
    { id: 'highkey', label: 'ハイキー', params: { keyAz: 0, keyEl: 25, keyDist: 2.2, keySize: 1.8, fill: 0.5, rim: 0, bg: 1.6, reflector: 0, backdrop: 1 } },
    { id: 'lowkey', label: 'ローキー', params: { keyAz: -70, keyEl: 35, keyDist: 1.6, keySize: 0.3, fill: 0, rim: 0.3, bg: 0, reflector: 3, reflAz: 80, reflDist: 0.7, backdrop: 2 } },
  ],
  create,
};
