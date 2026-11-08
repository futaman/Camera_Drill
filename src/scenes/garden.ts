// S3 彫刻庭園（屋外）: 芝生の中の胸像と、奥へ等間隔に続く列柱と街灯。
// 晴天から夜まで明るさを変えられ、圧縮効果・F16ルール・逆光・ダイナミックレンジを学ぶ。
// カメラは +z 側から -z 方向を向く。胸像は原点の台の上。

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneDef, SceneInstance } from './types';
import { createBust, shadowed } from './plaster';
import { gravelTexture, grassTexture, stoneTexture } from './textures';

const FACE = new THREE.Vector3(0, 1.56, 0.1);
/** 列柱の間隔 [m] */
const COLUMN_SPACING = 6;
const COLUMN_ROWS = 12;
const COLUMN_X = 3.2;
const BACKDROP_Z = -COLUMN_SPACING * COLUMN_ROWS - 14;
const SKY_RADIUS = 700;

interface SkyLook {
  zenith: string;
  horizon: string;
  /** 天頂・地平線の輝度 [cd/m²] */
  zenithL: number;
  horizonL: number;
  /** 太陽の円盤の輝度 [cd/m²]（表現できる範囲で頭打ち） */
  sunL: number;
  /** 太陽のまわりのにじみの輝度 [cd/m²] */
  haloL: number;
}

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunL: { value: 0 },
      uHaloL: { value: 0 },
      uSunColor: { value: new THREE.Color('#fff') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform float uSunL;
      uniform float uHaloL;
      uniform vec3 uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = pow(1.0 - clamp(d.y, 0.0, 1.0), 3.0);
        vec3 c = mix(uZenith, uHorizon, h);
        float a = max(dot(d, uSunDir), 0.0);
        c += uSunColor * uHaloL * pow(a, 40.0);
        c += uSunColor * uSunL * smoothstep(0.99985, 0.99995, a);
        gl_FragColor = vec4(min(c, vec3(60000.0)), 1.0);
      }
    `,
  });
}

/** 葉のかたまり（球を凹凸で変形した塊を積む）。幾何は1つにまとめて描画を軽くする */
function foliage(x: number, y: number, z: number, r: number, seed: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = seed * 12.9 + i * 2.1;
    // 頂点を共有させて、葉の塊の陰影をなめらかにする
    const radius = r * (0.62 + 0.2 * Math.sin(a * 3.1));
    const blob = mergeVertices(new THREE.IcosahedronGeometry(radius, 2).deleteAttribute('normal').deleteAttribute('uv'));
    const pos = blob.attributes.position;
    const v = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      const f = 7 / radius;
      const n = 1 + 0.14 * Math.sin(v.x * f + a) * Math.sin(v.y * f * 1.2) * Math.sin(v.z * f * 1.3 - a);
      pos.setXYZ(k, v.x * n, v.y * n, v.z * n);
    }
    blob.computeVertexNormals();
    blob.translate(x + r * 0.55 * Math.cos(a), y + r * 0.45 * Math.sin(a * 1.7), z + r * 0.55 * Math.sin(a));
    parts.push(blob);
  }
  return parts;
}

function create(): SceneInstance {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];

  const sky = skyMaterial();
  disposables.push(sky);
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), sky);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  // 地面
  const grass = grassTexture();
  grass.repeat.set(120, 120);
  const grassMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const gravel = gravelTexture();
  gravel.repeat.set(2, 90);
  const gravelMat = new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 180), gravelMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, -35);
  path.receiveShadow = true;
  scene.add(path);

  // 主役の胸像
  const stone = stoneTexture();
  stone.repeat.set(1, 3);
  const stoneMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.92 });
  disposables.push(grass, grassMat, gravel, gravelMat, stone, stoneMat);
  const pedestal = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.34), stoneMat));
  pedestal.position.y = 0.5;
  const bust = createBust();
  bust.position.y = 1.0;
  scene.add(pedestal, bust);

  // 列柱と街灯（奥へ等間隔に並ぶ。圧縮効果のものさし）
  const columnGeos: THREE.BufferGeometry[] = [];
  const poleGeos: THREE.BufferGeometry[] = [];
  const lampGeos: THREE.BufferGeometry[] = [];
  for (let i = 1; i <= COLUMN_ROWS; i++) {
    const z = -COLUMN_SPACING * i;
    for (const side of [-1, 1]) {
      const shaft = new THREE.CylinderGeometry(0.2, 0.25, 3.2, 24);
      shaft.translate(side * COLUMN_X, 1.9, z);
      const base = new THREE.BoxGeometry(0.72, 0.3, 0.72);
      base.translate(side * COLUMN_X, 0.15, z);
      const capital = new THREE.BoxGeometry(0.66, 0.24, 0.66);
      capital.translate(side * COLUMN_X, 3.62, z);
      columnGeos.push(shaft, base, capital);
      const pole = new THREE.CylinderGeometry(0.035, 0.05, 3, 10);
      pole.translate(side * 1.9, 1.5, z + COLUMN_SPACING / 2);
      poleGeos.push(pole);
      const lamp = new THREE.SphereGeometry(0.11, 16, 12);
      lamp.translate(side * 1.9, 3.1, z + COLUMN_SPACING / 2);
      lampGeos.push(lamp);
    }
  }
  const beamGeos: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const beam = new THREE.BoxGeometry(0.6, 0.3, COLUMN_SPACING * (COLUMN_ROWS - 1) + 0.6);
    beam.translate(side * COLUMN_X, 3.89, -(COLUMN_SPACING * (COLUMN_ROWS + 1)) / 2);
    beamGeos.push(beam);
  }
  const columns = shadowed(new THREE.Mesh(mergeGeometries([...columnGeos, ...beamGeos]), stoneMat));
  scene.add(columns);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#23262a', roughness: 0.5 });
  const poles = shadowed(new THREE.Mesh(mergeGeometries(poleGeos), poleMat));
  scene.add(poles);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#c9c4b8', emissive: new THREE.Color('#ffc27a'), roughness: 0.3 });
  const lamps = new THREE.Mesh(mergeGeometries(lampGeos), lampMat);
  scene.add(lamps);
  disposables.push(poleMat, lampMat);

  // 生け垣
  const hedgeMat = new THREE.MeshStandardMaterial({ color: '#2f4a24', roughness: 1 });
  const hedgeParts: THREE.BufferGeometry[] = [];
  for (let z = 4; z > BACKDROP_Z + 4; z -= 3.2) {
    for (const side of [-1, 1]) hedgeParts.push(...foliage(side * 7, 0.9, z, 1.45, z * side));
  }
  const hedge = shadowed(new THREE.Mesh(mergeGeometries(hedgeParts), hedgeMat));
  scene.add(hedge);

  // 奥の木立
  const treeMat = new THREE.MeshStandardMaterial({ color: '#35532a', roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3e2f25', roughness: 1 });
  const crowns: THREE.BufferGeometry[] = [];
  const trunks: THREE.BufferGeometry[] = [];
  const addTree = (x: number, z: number, s: number, seed: number) => {
    const trunk = new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 4 * s, 8);
    trunk.translate(x, 2 * s, z);
    trunks.push(trunk);
    crowns.push(...foliage(x, 5.2 * s, z, 3.2 * s, seed), ...foliage(x, 7.2 * s, z, 2.4 * s, seed + 3));
  };
  for (let i = 0; i < 26; i++) {
    const x = -52 + i * 4.2 + 2 * Math.sin(i * 2.3);
    addTree(x, BACKDROP_Z + 3 * Math.sin(i * 1.7), 1.1 + 0.3 * Math.sin(i * 0.9), i);
  }
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    addTree(side * (17 + 6 * Math.sin(i * 1.3)), 12 - i * 5.5, 1 + 0.25 * Math.cos(i), 40 + i);
  }
  const crownMesh = shadowed(new THREE.Mesh(mergeGeometries(crowns), treeMat));
  const trunkMesh = shadowed(new THREE.Mesh(mergeGeometries(trunks), trunkMat));
  scene.add(crownMesh, trunkMesh);
  disposables.push(hedgeMat, treeMat, trunkMat);

  // 夜の玉ボケ用: 列柱のあいだに張った電球
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color('#ffc978') });
  const bulbGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < COLUMN_ROWS; i++) {
    for (let k = 0; k < 7; k++) {
      const u = (k + 0.5) / 7;
      const b = new THREE.SphereGeometry(0.03, 10, 8);
      b.translate(-COLUMN_X + u * COLUMN_X * 2, 3.5 - 0.5 * Math.sin(Math.PI * u), -COLUMN_SPACING * (i + 1));
      bulbGeos.push(b);
    }
  }
  const bulbs = new THREE.Mesh(mergeGeometries(bulbGeos), bulbMat);
  scene.add(bulbs);
  disposables.push(bulbMat);

  // 照明: 太陽は lx、空の光は環境光（lx）、点光源は cd
  const sun = new THREE.DirectionalLight('#fff', 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.target.position.set(0, 1, -8);
  const hemi = new THREE.HemisphereLight('#fff', '#fff', 1);
  scene.add(sun, sun.target, hemi);

  const nightLamp = new THREE.PointLight('#ffb777', 0, 0, 2);
  nightLamp.position.set(1.6, 3.1, 1.4);
  scene.add(nightLamp);

  const setSun = (azimuthDeg: number, elevationDeg: number) => {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sun.position.copy(sun.target.position).addScaledVector(d, 90);
    sky.uniforms.uSunDir.value.copy(d);
  };

  const setSky = (look: SkyLook, sunColor: string) => {
    sky.uniforms.uZenith.value.set(look.zenith).multiplyScalar(look.zenithL);
    sky.uniforms.uHorizon.value.set(look.horizon).multiplyScalar(look.horizonL);
    sky.uniforms.uSunL.value = look.sunL;
    sky.uniforms.uHaloL.value = look.haloL;
    sky.uniforms.uSunColor.value.set(sunColor);
  };

  const setLighting = (id: string) => {
    nightLamp.intensity = 0;
    lampMat.emissiveIntensity = 0;
    bulbs.visible = id === 'night' || id === 'sunset';
    bulbMat.emissiveIntensity = id === 'sunset' ? 600 : 0;
    sun.color.set('#fff6ea');
    hemi.color.set('#cfe0ff');
    hemi.groundColor.set('#7c8a5a');

    switch (id) {
      case 'backlit': // 晴天の逆光（太陽が被写体の後ろ）
        setSun(172, 26);
        sun.intensity = 85000;
        hemi.intensity = 26000;
        setSky({ zenith: '#3f7fd8', horizon: '#dbe9fb', zenithL: 9000, horizonL: 14000, sunL: 60000, haloL: 30000 }, '#fff3dc');
        break;
      case 'cloudy': // 曇り（太陽は隠れて影がほとんどない）
        setSun(30, 60);
        sun.intensity = 2500;
        sun.color.set('#e8ecf2');
        hemi.intensity = 13000;
        hemi.color.set('#e6e9ee');
        setSky({ zenith: '#c7ccd4', horizon: '#e6e8ec', zenithL: 4200, horizonL: 3800, sunL: 0, haloL: 300 }, '#ffffff');
        break;
      case 'sunset': // 夕暮れ（低い太陽）
        setSun(120, 6);
        sun.intensity = 3500;
        sun.color.set('#ff9a55');
        hemi.intensity = 1600;
        hemi.color.set('#8fa4d6');
        hemi.groundColor.set('#6a5a4a');
        setSky({ zenith: '#46609f', horizon: '#ffb37a', zenithL: 180, horizonL: 800, sunL: 30000, haloL: 3500 }, '#ff9a55');
        break;
      case 'night': // 夜（街灯と電球）
        setSun(30, 40);
        sun.intensity = 0.1;
        sun.color.set('#b8c8ff');
        hemi.intensity = 0.25;
        hemi.color.set('#6f83c9');
        hemi.groundColor.set('#26221d');
        nightLamp.intensity = 90;
        lampMat.emissiveIntensity = 2500;
        bulbMat.emissiveIntensity = 4000;
        setSky({ zenith: '#0b1330', horizon: '#26304f', zenithL: 0.02, horizonL: 0.12, sunL: 0, haloL: 0 }, '#ffffff');
        break;
      default: // 晴天の順光（太陽はカメラの後ろ）
        setSun(-32, 52);
        sun.intensity = 90000;
        hemi.intensity = 20000;
        setSky({ zenith: '#3f7fd8', horizon: '#cfe0f6', zenithL: 8000, horizonL: 11000, sunL: 60000, haloL: 3000 }, '#fff6ea');
    }
  };
  setLighting('sunny');

  return {
    scene,
    focusTargets: [bust, pedestal, columns, hedge, crownMesh, trunkMesh, poles, ground, path],
    setLighting,
    update() {},
    cameraPose(params) {
      return { position: new THREE.Vector3(0, 1.55, params.distance), target: new THREE.Vector3(0, 1.52, 0) };
    },
    keyPoints() {
      return [
        { id: 'subject', label: '胸像の顔', position: FACE.clone() },
        { id: 'background', label: '奥の木立', position: new THREE.Vector3(0, 3, BACKDROP_Z) },
      ];
    },
    motion() {
      return { speed: 0, distance: 1 };
    },
    depthRange(params) {
      return { near: Math.max(0.5, params.distance - 1), far: SKY_RADIUS };
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

export const garden: SceneDef = {
  id: 'garden',
  name: '彫刻庭園（屋外）',
  description: '芝生の庭の胸像と、奥へ6m間隔で続く列柱。晴天・逆光・曇り・夕暮れ・夜を切り替えられる。',
  lighting: [
    { id: 'sunny', label: '晴天（順光）' },
    { id: 'backlit', label: '晴天（逆光）' },
    { id: 'cloudy', label: '曇り' },
    { id: 'sunset', label: '夕暮れ' },
    { id: 'night', label: '夜（街灯と電球）' },
  ],
  params: [{ id: 'distance', label: '被写体までの距離', min: 1.2, max: 40, step: 0.1, default: 4, unit: 'm' }],
  create,
};
