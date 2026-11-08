// コードで生成する石膏像。Phase 2 で CC0 のスキャンモデルに差し替える予定。

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function plasterMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color('#ebe8e1'), roughness: 0.82, metalness: 0 });
}

function shadowed<T extends THREE.Object3D>(obj: T): T {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return obj;
}

/** 巻き毛のある頭髪（球を凹凸で変形） */
function hairGeometry(): THREE.BufferGeometry {
  // 頂点を共有させて、法線をなめらかにする
  const geo = mergeVertices(new THREE.IcosahedronGeometry(0.104, 6).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const curl =
      Math.sin(n.x * 38 + Math.sin(n.y * 21) * 2) * Math.sin(n.y * 34) * Math.sin(n.z * 29 + n.x * 7);
    v.addScaledVector(n, curl * 0.006);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** ガウス関数の盛り上がり（負ならくぼみ）。cx, cy は正面から見た位置（-1〜1） */
function bump(x: number, y: number, cx: number, cy: number, sx: number, sy: number, height: number): number {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return height * Math.exp(-(dx * dx + dy * dy));
}

/** 顔の彫りを、球の表面の盛り上がりとくぼみで作る。光の当たり方で陰影が出るよう1枚の面にする */
function headGeometry(): THREE.BufferGeometry {
  const geo = mergeVertices(new THREE.SphereGeometry(1, 128, 96).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // 正面側だけ彫る
    const front = Math.min(1, Math.max(0, z / 0.35));
    const r =
      1 +
      front *
        (bump(x, y, 0, -0.08, 0.1, 0.3, 0.24) + // 鼻筋
          bump(x, y, 0, -0.3, 0.13, 0.09, 0.1) + // 鼻先
          bump(x, y, 0, 0.3, 0.6, 0.08, 0.05) + // 眉
          bump(x, y, -0.32, 0.12, 0.17, 0.09, -0.1) + // 眼窩
          bump(x, y, 0.32, 0.12, 0.17, 0.09, -0.1) +
          bump(x, y, -0.32, 0.12, 0.09, 0.05, 0.05) + // まぶた
          bump(x, y, 0.32, 0.12, 0.09, 0.05, 0.05) +
          bump(x, y, -0.48, -0.22, 0.2, 0.2, 0.045) + // 頬
          bump(x, y, 0.48, -0.22, 0.2, 0.2, 0.045) +
          bump(x, y, 0, -0.5, 0.2, 0.035, 0.06) + // 上唇
          bump(x, y, 0, -0.58, 0.28, 0.018, -0.03) + // 口
          bump(x, y, 0, -0.65, 0.17, 0.04, 0.06) + // 下唇
          bump(x, y, 0, -0.86, 0.22, 0.12, 0.1)); // あご
    // あごに向かって細くする
    const taper = 1 - 0.26 * Math.min(1, Math.max(0, -y));
    pos.setXYZ(i, x * r * taper, y * r, z * r);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 胸像。原点は台座の底面中央で、高さは約0.68m。正面は +z */
export function createBust(): THREE.Group {
  const mat = plasterMaterial();
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };

  // 台座
  add(new THREE.BoxGeometry(0.2, 0.07, 0.17), 0, 0.035, 0);
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 48), 0, 0.1, 0);

  // 胸と肩、首
  const profile = [
    [0.0, 0], [0.06, 0], [0.1, 0.03], [0.15, 0.09], [0.168, 0.15], [0.155, 0.2], [0.11, 0.235],
    [0.06, 0.252], [0.05, 0.275], [0.047, 0.34], [0.0, 0.34],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(profile, 64), 0, 0.13, 0, 1, 1, 0.62);

  // 頭部
  const headY = 0.56;
  add(headGeometry(), 0, headY, 0, 0.08, 0.112, 0.094);
  add(new THREE.SphereGeometry(0.02, 24, 16), -0.08, headY, -0.005, 0.5, 1.4, 0.9); // 耳
  add(new THREE.SphereGeometry(0.02, 24, 16), 0.08, headY, -0.005, 0.5, 1.4, 0.9);
  add(hairGeometry(), 0, headY + 0.04, -0.035, 0.84, 0.86, 0.93);

  return shadowed(g);
}

export type SolidKind = 'sphere' | 'cube' | 'cone' | 'cylinder' | 'hexagon';

/** 石膏の幾何形体。原点は底面中央 */
export function createSolid(kind: SolidKind, size = 1): THREE.Mesh {
  const mat = plasterMaterial();
  let geo: THREE.BufferGeometry;
  let h: number;
  switch (kind) {
    case 'sphere':
      geo = new THREE.SphereGeometry(0.1, 64, 48);
      h = 0.1;
      break;
    case 'cube':
      geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      h = 0.08;
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(0.09, 0.24, 64);
      h = 0.12;
      break;
    case 'cylinder':
      geo = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 64);
      h = 0.11;
      break;
    case 'hexagon':
      geo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6);
      h = 0.1;
      break;
  }
  geo.translate(0, h, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(size);
  return shadowed(mesh);
}

export { shadowed };
