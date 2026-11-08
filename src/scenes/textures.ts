// Canvas で描く手続き的テクスチャ。背景の細かい模様はボケの変化を見やすくする。

import * as THREE from 'three';

function makeCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 木の床（板張り） */
export function woodFloorTexture(): THREE.CanvasTexture {
  const rand = rng(7);
  const tex = makeCanvas(1024, 1024, (ctx) => {
    const plankH = 64;
    for (let y = 0; y < 1024; y += plankH) {
      let x = -Math.floor(rand() * 400);
      while (x < 1024) {
        const len = 300 + rand() * 400;
        const base = 95 + rand() * 30;
        ctx.fillStyle = `rgb(${base + 40}, ${base * 0.72}, ${base * 0.45})`;
        ctx.fillRect(x, y, len, plankH);
        for (let i = 0; i < 14; i++) {
          ctx.strokeStyle = `rgba(60, 35, 20, ${0.08 + rand() * 0.12})`;
          ctx.lineWidth = 1 + rand() * 2;
          ctx.beginPath();
          const yy = y + rand() * plankH;
          ctx.moveTo(x, yy);
          ctx.bezierCurveTo(x + len / 3, yy + rand() * 6 - 3, x + (2 * len) / 3, yy + rand() * 6 - 3, x + len, yy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(30, 18, 10, 0.6)';
        ctx.fillRect(x, y, 2, plankH);
        x += len;
      }
      ctx.fillStyle = 'rgba(30, 18, 10, 0.55)';
      ctx.fillRect(0, y, 1024, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 抽象画（色の面と線）。背景のボケを確認する目印になる */
export function paintingTexture(seed: number): THREE.CanvasTexture {
  const rand = rng(seed);
  const palette = ['#d94f30', '#f2b134', '#2a6f97', '#1b998b', '#e8e1d0', '#26282b', '#c6538c'];
  return makeCanvas(768, 576, (ctx) => {
    ctx.fillStyle = '#efe8d8';
    ctx.fillRect(0, 0, 768, 576);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      ctx.globalAlpha = 0.75 + rand() * 0.25;
      if (rand() < 0.5) {
        ctx.fillRect(rand() * 700, rand() * 520, 30 + rand() * 220, 20 + rand() * 180);
      } else {
        ctx.beginPath();
        ctx.arc(rand() * 768, rand() * 576, 15 + rand() * 90, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#1d1d1f';
    for (let i = 0; i < 18; i++) {
      ctx.lineWidth = 2 + rand() * 6;
      ctx.beginPath();
      ctx.moveTo(rand() * 768, rand() * 576);
      ctx.lineTo(rand() * 768, rand() * 576);
      ctx.stroke();
    }
  });
}

/** 細かい格子（スタジオの背景紙） */
export function gridTexture(): THREE.CanvasTexture {
  const tex = makeCanvas(512, 512, (ctx) => {
    ctx.fillStyle = '#6d6f73';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#55575b';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 回転台の天板（放射状の目盛り）。回転のブレが分かりやすい */
export function turntableTexture(): THREE.CanvasTexture {
  return makeCanvas(512, 512, (ctx) => {
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, 512, 512);
    ctx.translate(256, 256);
    for (let i = 0; i < 36; i++) {
      ctx.rotate((Math.PI * 2) / 36);
      ctx.fillStyle = i % 9 === 0 ? '#f2b134' : '#d8d8d8';
      ctx.fillRect(170, -3, i % 3 === 0 ? 80 : 40, 6);
    }
  });
}

function speckle(base: [number, number, number], spread: number, seed: number, strokes: number): THREE.CanvasTexture {
  const rand = rng(seed);
  const tex = makeCanvas(512, 512, (ctx) => {
    ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < strokes; i++) {
      const d = (rand() - 0.5) * spread;
      ctx.fillStyle = `rgb(${base[0] + d}, ${base[1] + d}, ${base[2] + d * 0.7})`;
      ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, 1 + rand() * 6);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 芝生 */
export function grassTexture(): THREE.CanvasTexture {
  return speckle([78, 112, 52], 46, 21, 16000);
}

/** 砂利の小道 */
export function gravelTexture(): THREE.CanvasTexture {
  return speckle([150, 140, 122], 60, 33, 14000);
}

/** 石材（列柱と台座） */
export function stoneTexture(): THREE.CanvasTexture {
  return speckle([176, 170, 158], 22, 47, 8000);
}

/** 本の背表紙の色 */
export function bookColors(count: number, seed: number): THREE.Color[] {
  const rand = rng(seed);
  const palette = ['#7a2e2e', '#2e4a7a', '#3d6b3d', '#b08a3c', '#5b3a6e', '#2a2a2a', '#c9c1b0', '#9a4b2a'];
  return Array.from({ length: count }, () => new THREE.Color(palette[Math.floor(rand() * palette.length)]));
}
