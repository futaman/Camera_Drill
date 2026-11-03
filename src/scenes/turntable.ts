// S2 回転台: スタジオで回転台に載った胸像。シャッタースピードと被写体ブレを学ぶ。

import * as THREE from 'three';
import type { SceneDef, SceneInstance } from './types';
import { createBust, shadowed } from './plaster';
import { gridTexture, turntableTexture } from './textures';

const TABLE_TOP = 0.95;
const TABLE_RADIUS = 0.28;

function create(): SceneInstance {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];

  const grid = gridTexture();
  grid.repeat.set(6, 3);
  const backdropMat = new THREE.MeshStandardMaterial({ map: grid, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#3a3b3e', roughness: 0.9 });
  const standMat = new THREE.MeshStandardMaterial({ color: '#1e1f22', roughness: 0.5 });
  const topTex = turntableTexture();
  const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.6 });
  disposables.push(grid, backdropMat, floorMat, standMat, topTex, topMat);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), backdropMat);
  backdrop.position.set(0, 2.5, -3);
  backdrop.receiveShadow = true;
  scene.add(floor, backdrop);

  const stand = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, TABLE_TOP - 0.04, 32), standMat));
  stand.position.y = (TABLE_TOP - 0.04) / 2;
  scene.add(stand);

  // 回転する部分（天板＋胸像）
  const spinner = new THREE.Group();
  const topSide = new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.6 });
  disposables.push(topSide);
  const top = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.04, 64), [topSide, topMat, topSide]),
  );
  top.position.y = TABLE_TOP - 0.02;
  const bust = createBust();
  bust.position.y = TABLE_TOP;
  spinner.add(top, bust);
  scene.add(spinner);

  const key = new THREE.DirectionalLight('#ffffff', 1);
  key.position.set(-3, 4, 3);
  key.target.position.set(0, 1.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -4;
  sc.right = 4;
  sc.top = 4;
  sc.bottom = -4;
  sc.near = 1;
  sc.far = 15;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight('#dfe8ff', 1);
  rim.position.set(3, 3, -2);
  const ambient = new THREE.AmbientLight('#ffffff', 1);
  scene.add(key, key.target, rim, ambient);

  const setLighting = (id: string) => {
    const k = id === 'dim' ? 0.08 : 1;
    key.intensity = 1000 * k;
    rim.intensity = 250 * k;
    ambient.intensity = 220 * k;
  };
  setLighting('studio');

  return {
    scene,
    focusTargets: [spinner, backdrop, floor, stand],
    setLighting,
    update(params, timeSec) {
      spinner.rotation.y = ((params.rpm * Math.PI * 2) / 60) * timeSec;
    },
    cameraPose(params) {
      return {
        position: new THREE.Vector3(0, 1.52, params.distance),
        target: new THREE.Vector3(0, 1.42, 0),
      };
    },
    keyPoints() {
      return [
        { id: 'subject', label: '胸像の顔', position: new THREE.Vector3(0, TABLE_TOP + 0.56, 0.1) },
        { id: 'background', label: '背景紙', position: new THREE.Vector3(0, 1.5, -3) },
      ];
    },
    motion(params) {
      return { speed: (2 * Math.PI * TABLE_RADIUS * params.rpm) / 60, distance: params.distance };
    },
    depthRange(params) {
      return { near: Math.max(0.3, params.distance - TABLE_RADIUS), far: params.distance + 3.1 };
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

export const turntable: SceneDef = {
  id: 'turntable',
  name: '回転台',
  description: 'スタジオの回転台に載った胸像。回転の速さを変えて、被写体ブレを確かめる。',
  lighting: [
    { id: 'studio', label: '明るいスタジオ' },
    { id: 'dim', label: '暗めの部屋' },
  ],
  params: [
    { id: 'rpm', label: '回転の速さ', min: 0, max: 60, step: 1, default: 15, unit: 'rpm' },
    { id: 'distance', label: '被写体までの距離', min: 1.2, max: 4, step: 0.05, default: 2.2, unit: 'm' },
  ],
  create,
};
