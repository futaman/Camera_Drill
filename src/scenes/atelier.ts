// S1 アトリエ: 窓辺の胸像、奥のテーブルの幾何形体、奥の壁の棚と絵とストリングライト。
// カメラは +z 側から -z 方向を向く。胸像は原点の台の上。

import * as THREE from 'three';
import type { SceneDef, SceneInstance } from './types';
import { createBust, createSolid, shadowed } from './plaster';
import { bookColors, paintingTexture, woodFloorTexture } from './textures';

const BACK_Z = -4.5;
const FACE = new THREE.Vector3(0, 1.56, 0.1);

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return shadowed(m);
}

function create(): SceneInstance {
  const scene = new THREE.Scene();
  const focusTargets: THREE.Object3D[] = [];
  const disposables: { dispose(): void }[] = [];

  const wallMat = new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: 0.95 });
  const backWallMat = new THREE.MeshStandardMaterial({ color: '#647a88', roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#5a3d2b', roughness: 0.7 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6 });
  const floorTex = woodFloorTexture();
  floorTex.repeat.set(3, 3);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.65 });
  disposables.push(wallMat, backWallMat, woodMat, frameMat, floorMat, floorTex);

  // 部屋
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 10.2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.55);
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(box(6.2, 0.1, 10.4, wallMat, 0, 3.05, 0.55)); // 天井
  scene.add(box(0.1, 3, 10.2, wallMat, 3.05, 1.5, 0.55)); // 右の壁
  scene.add(box(6.2, 3, 0.1, backWallMat, 0, 1.5, BACK_Z - 0.05)); // 奥の壁
  scene.add(box(6.2, 3, 0.1, wallMat, 0, 1.5, 5.7)); // 手前の壁
  // 左の壁（窓の穴: z -2〜0.5, y 0.8〜2.6）
  scene.add(box(0.1, 0.8, 10.2, wallMat, -3.05, 0.4, 0.55));
  scene.add(box(0.1, 0.4, 10.2, wallMat, -3.05, 2.8, 0.55));
  scene.add(box(0.1, 1.8, 2.5, wallMat, -3.05, 1.7, -3.25));
  scene.add(box(0.1, 1.8, 5.15, wallMat, -3.05, 1.7, 3.075));
  // 窓枠
  scene.add(box(0.06, 1.8, 0.05, frameMat, -3.0, 1.7, -0.75));
  scene.add(box(0.06, 0.05, 2.5, frameMat, -3.0, 1.7, -0.75));

  // 窓の外の空
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color('#d6e4ff') });
  disposables.push(skyMat);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), skyMat);
  sky.rotation.y = Math.PI / 2;
  sky.position.set(-3.3, 1.7, -0.75);
  scene.add(sky);

  // 主役の胸像
  const column = box(0.3, 1.0, 0.3, wallMat, 0, 0.5, 0);
  const bust = createBust();
  bust.position.set(0, 1.0, 0);
  scene.add(column, bust);
  focusTargets.push(bust, column);

  // 手前の小さな球（前ボケ用）
  const rod = box(0.015, 1.2, 0.015, frameMat, -0.24, 0.6, 1.3);
  const fgSphere = createSolid('sphere', 0.5);
  fgSphere.position.set(-0.24, 1.2, 1.3);
  scene.add(rod, fgSphere);
  focusTargets.push(fgSphere);

  // 奥のテーブルと幾何形体
  const table = new THREE.Group();
  table.add(box(1.4, 0.05, 0.8, woodMat, 0, 0.75, 0));
  for (const [x, z] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) {
    table.add(box(0.05, 0.75, 0.05, woodMat, x, 0.375, z));
  }
  const solids: [Parameters<typeof createSolid>[0], number, number][] = [
    ['cube', -0.45, 0.05], ['sphere', -0.12, -0.15], ['cone', 0.18, 0.1], ['cylinder', 0.45, -0.1],
  ];
  for (const [kind, x, z] of solids) {
    const s = createSolid(kind);
    s.position.set(x, 0.775, z);
    table.add(s);
  }
  table.position.set(0.55, 0, -1.8);
  scene.add(table);
  focusTargets.push(table);

  // 奥の壁: 棚と本
  const shelf = new THREE.Group();
  const colors = bookColors(60, 5);
  let ci = 0;
  for (const y of [0.95, 1.45, 1.95]) {
    shelf.add(box(2.0, 0.03, 0.3, woodMat, 0, y, 0));
    let x = -0.95;
    while (x < 0.8) {
      const w = 0.025 + ((ci * 37) % 10) / 400;
      const h = 0.2 + ((ci * 53) % 10) / 70;
      const mat = new THREE.MeshStandardMaterial({ color: colors[ci % colors.length], roughness: 0.8 });
      disposables.push(mat);
      shelf.add(box(w, h, 0.22, mat, x + w / 2, y + 0.015 + h / 2, 0));
      x += w + 0.004;
      ci++;
    }
  }
  const shelfSolid = createSolid('hexagon', 0.8);
  shelfSolid.position.set(0.85, 1.965, 0);
  shelf.add(shelfSolid);
  shelf.position.set(-1.6, 0, BACK_Z + 0.16);
  scene.add(shelf);
  focusTargets.push(shelf);

  // 奥の壁: 絵
  const paintings: [number, number, number, number, number][] = [
    [1.35, 1.6, 1.1, 0.82, 3],
    [0.15, 2.15, 0.5, 0.38, 11],
  ];
  for (const [x, y, w, h, seed] of paintings) {
    const tex = paintingTexture(seed);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    disposables.push(tex, mat);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.set(x, y, BACK_Z + 0.03);
    scene.add(box(w + 0.08, h + 0.08, 0.03, frameMat, x, y, BACK_Z + 0.01), p);
    focusTargets.push(p);
  }
  const backWall = scene.children.find((o) => o.position.z === BACK_Z - 0.05);
  if (backWall) focusTargets.push(backWall);
  focusTargets.push(floor);

  // ストリングライト（玉ボケ用）
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color('#ffc978') });
  disposables.push(bulbMat);
  const bulbGeo = new THREE.SphereGeometry(0.014, 12, 8);
  disposables.push(bulbGeo);
  const bulbs = 30;
  for (let i = 0; i < bulbs; i++) {
    const u = i / (bulbs - 1);
    const x = -2.7 + u * 5.4;
    const y = 2.45 - 0.42 * Math.sin(Math.PI * ((u * 2) % 1));
    const b = new THREE.Mesh(bulbGeo, bulbMat);
    b.position.set(x, y, BACK_Z + 0.12);
    scene.add(b);
  }

  // 照明
  const sun = new THREE.DirectionalLight('#fff4e6', 1);
  sun.position.set(-8, 3, 1);
  sun.target.position.set(0, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -7;
  sc.right = 7;
  sc.top = 7;
  sc.bottom = -7;
  sc.near = 1;
  sc.far = 20;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const ambient = new THREE.AmbientLight('#e8eef5', 1);
  scene.add(ambient);

  const lamp = new THREE.PointLight('#ffb46b', 0, 0, 2);
  lamp.position.set(1.3, 2.7, 1.2);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.002;
  scene.add(lamp);

  // 照明の強さは物理単位: 平行光と環境光は lx、点光源は cd、発光面は cd/m²
  const setLighting = (id: string) => {
    if (id === 'night') {
      sun.intensity = 0;
      ambient.intensity = 4;
      ambient.color.set('#ffd9b0');
      lamp.intensity = 220;
      skyMat.emissiveIntensity = 0.4;
      skyMat.emissive.set('#3a4a78');
      bulbMat.emissiveIntensity = 3000;
    } else if (id === 'cloudy') {
      sun.intensity = 500;
      ambient.intensity = 200;
      ambient.color.set('#e8eef5');
      lamp.intensity = 0;
      skyMat.emissiveIntensity = 1800;
      skyMat.emissive.set('#e4e9f2');
      bulbMat.emissiveIntensity = 3000;
    } else {
      sun.intensity = 1400;
      ambient.intensity = 420;
      ambient.color.set('#e8eef5');
      lamp.intensity = 0;
      skyMat.emissiveIntensity = 6000;
      skyMat.emissive.set('#d6e4ff');
      bulbMat.emissiveIntensity = 3000;
    }
  };
  setLighting('day');

  return {
    scene,
    focusTargets,
    setLighting,
    update() {},
    cameraPose(params) {
      const d = params.distance;
      return { position: new THREE.Vector3(0, 1.55, d), target: new THREE.Vector3(0, 1.52, 0) };
    },
    keyPoints() {
      return [
        { id: 'subject', label: '胸像の顔', position: FACE.clone() },
        { id: 'background', label: '奥の壁', position: new THREE.Vector3(0, 1.6, BACK_Z) },
        { id: 'foreground', label: '手前の球', position: new THREE.Vector3(-0.24, 1.25, 1.3) },
      ];
    },
    motion() {
      return { speed: 0, distance: 1 };
    },
    depthRange(params) {
      const d = params.distance;
      return { near: d > 1.45 ? Math.max(0.3, d - 1.35) : 0.4, far: d - BACK_Z + 0.1 };
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

export const atelier: SceneDef = {
  id: 'atelier',
  name: 'アトリエ',
  description: '窓から光が入るアトリエ。胸像の奥にテーブル、さらに奥の壁に棚と絵とストリングライトがある。',
  lighting: [
    { id: 'day', label: '晴れた日の窓辺' },
    { id: 'cloudy', label: '曇りの日' },
    { id: 'night', label: '夜（電球の明かり）' },
  ],
  params: [{ id: 'distance', label: '被写体までの距離', min: 0.8, max: 5, step: 0.05, default: 2, unit: 'm' }],
  create,
};
