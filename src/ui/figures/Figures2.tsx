// 講座の図解（センササイズ、圧縮効果、モード、Log、収差、APS-Cコラム）。

import { useEffect, useRef, useState } from 'react';
import {
  LOG_HEADROOM_STOPS,
  SATURATION,
  airyDiskMm,
  croppedMegapixels,
  cropFactor,
  getBody,
  logEncode,
  pixelPitch,
  pixelsPerMm,
  type Body,
} from '../../physics';

export function Sensors() {
  const items = [
    { id: 'ff-24', label: 'フルサイズ' },
    { id: 'apsc-24', label: 'APS-C' },
    { id: 'm43-20', label: 'マイクロフォーサーズ' },
    { id: '1in-20', label: '1インチ' },
  ];
  const scale = 4.6;
  return (
    <svg className="figure" viewBox="0 0 600 130" role="img" aria-label="センササイズの比較">
      {items.map((it, i) => {
        const b = getBody(it.id);
        const x = 18 + i * 148;
        const w = b.width * scale;
        const h = b.height * scale;
        return (
          <g key={it.id}>
            <rect x={x} y={8} width={36 * scale} height={24 * scale} className="fig-sensor-frame" />
            <rect x={x + (36 * scale - w) / 2} y={8 + (24 * scale - h) / 2} width={w} height={h} className="fig-sensor-area" />
            <text x={x + 18 * scale} y={8 + 12 * scale + 4} textAnchor="middle" className="fig-text small ink">
              ×{cropFactor(b).toFixed(2)}
            </text>
            <text x={x + 18 * scale} y={126} textAnchor="middle" className="fig-text small">
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 近くから撮る場合と遠くから撮る場合で、被写体と背景の見かけの大きさの比が変わる */
export function Compression() {
  const rows = [
    { y: 34, subject: 2, label: '近くから（2m）' },
    { y: 104, subject: 20, label: '遠くから（20m）' },
  ];
  const gap = 10; // 被写体と背景の距離 [m]
  const scale = 9.4;
  return (
    <svg className="figure" viewBox="0 0 600 150" role="img" aria-label="撮影距離と見かけの大きさの比">
      {rows.map((r) => {
        const sx = 24 + r.subject * scale;
        const bx = 24 + (r.subject + gap) * scale;
        const ratio = (r.subject + gap) / r.subject;
        return (
          <g key={r.label}>
            <rect x={12} y={r.y - 6} width={12} height={12} rx={2} className="tv-camera" />
            <line x1={24} y1={r.y} x2={bx} y2={r.y - 12} className="fig-ray" />
            <line x1={24} y1={r.y} x2={bx} y2={r.y + 12} className="fig-ray" />
            <circle cx={sx} cy={r.y} r={4} className="tv-subject" />
            <line x1={bx} y1={r.y - 12} x2={bx} y2={r.y + 12} className="fig-bg-line" />
            <text x={12} y={r.y - 14} className="fig-text small">
              {r.label}
            </text>
            <text x={590} y={r.y + 4} textAnchor="end" className="fig-text accent">
              背景は被写体の 1/{Number(ratio.toFixed(1))} の大きさ
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function EvScale() {
  const rows: [number, string][] = [
    [15, '晴天の屋外'],
    [12.5, '曇り'],
    [11, '日陰'],
    [8.5, '明るい室内'],
    [6.5, '一般的な室内'],
    [4, '夜の街'],
    [-2.5, '月明かり'],
  ];
  return (
    <svg className="figure" viewBox="0 0 600 170" role="img" aria-label="シーンごとの EV の目安">
      {rows.map(([ev, label], i) => {
        const y = 10 + i * 23;
        const w = ((ev + 4) / 20) * 420;
        return (
          <g key={label}>
            <text x={100} y={y + 12} textAnchor="end" className="fig-text small">
              {label}
            </text>
            <rect x={108} y={y} width={w} height={16} rx={3} className="fig-bar" />
            <text x={114 + w} y={y + 12} className="fig-text small accent">
              EV {ev}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Modes() {
  const rows = [
    ['M', '自分', '自分', '自分（またはオート）'],
    ['A', '自分', 'カメラ', '自分（またはオート）'],
    ['S', 'カメラ', '自分', '自分（またはオート）'],
    ['P', 'カメラ', 'カメラ', '自分（またはオート）'],
  ];
  return (
    <table className="figure-table">
      <caption>誰が決めるか</caption>
      <thead>
        <tr>
          <th>モード</th>
          <th>F値</th>
          <th>シャッタースピード</th>
          <th>ISO</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]}>
            <td>
              <b>{r[0]}</b>
            </td>
            {r.slice(1).map((c, i) => (
              <td key={i} className={c === 'カメラ' ? 'muted' : ''}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 標準と Log の階調曲線 */
export function LogCurve() {
  const W = 600;
  const H = 180;
  const x = (stops: number) => 44 + ((stops + 8) / 14) * (W - 60);
  const y = (v: number) => H - 26 - v * (H - 40);
  const srgb = (c: number) => (c < 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const standard = (stops: number) => srgb(Math.min(1, (0.18 * 2 ** stops) / SATURATION) ** 0.835);
  const path = (f: (s: number) => number, to: number) => {
    const pts: string[] = [];
    for (let s = -8; s <= to + 1e-6; s += 0.25) pts.push(`${x(s).toFixed(1)},${y(f(s)).toFixed(1)}`);
    return pts.join(' ');
  };
  return (
    <svg className="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="標準と Log の階調曲線">
      {[-8, -6, -4, -2, 0, 2, 4, 6].map((s) => (
        <g key={s}>
          <line x1={x(s)} y1={y(0)} x2={x(s)} y2={y(1)} className="fig-grid" />
          <text x={x(s)} y={H - 8} textAnchor="middle" className="fig-text small">
            {s > 0 ? `+${s}` : s}
          </text>
        </g>
      ))}
      <text x={W - 16} y={H - 8} textAnchor="end" className="fig-text small">
        段
      </text>
      <text x={4} y={y(1) + 8} className="fig-text small">
        記録値
      </text>
      <polyline points={path(standard, Math.log2(SATURATION / 0.18))} className="fig-curve-std" />
      <polyline points={path((s) => logEncode(0.18 * 2 ** s), LOG_HEADROOM_STOPS)} className="fig-curve-log" />
      <text x={x(1.2)} y={y(0.97)} className="fig-text small" textAnchor="end">
        標準（約+3段で飽和）
      </text>
      <text x={x(5.6)} y={y(0.72)} className="fig-text small accent" textAnchor="end">
        Log（約+6段まで残る）
      </text>
    </svg>
  );
}

const RAY_COLORS = ['#ff6b5e', '#6fdc7a', '#6fb6ff'];

export function Chromatic() {
  const lensX = 180;
  const focus = [470, 440, 410];
  const edge = 46;
  return (
    <svg className="figure" viewBox="0 0 600 140" role="img" aria-label="色ごとに集まる位置がずれる図">
      {focus.map((fx, i) => (
        <g key={fx}>
          <line x1={20} y1={70 - edge} x2={lensX} y2={70 - edge} stroke={RAY_COLORS[i]} className="fig-ray-c" />
          <line x1={20} y1={70 + edge} x2={lensX} y2={70 + edge} stroke={RAY_COLORS[i]} className="fig-ray-c" />
          <line x1={lensX} y1={70 - edge} x2={fx} y2={70} stroke={RAY_COLORS[i]} className="fig-ray-c" />
          <line x1={lensX} y1={70 + edge} x2={fx} y2={70} stroke={RAY_COLORS[i]} className="fig-ray-c" />
          <circle cx={fx} cy={70} r={3} fill={RAY_COLORS[i]} />
        </g>
      ))}
      <ellipse cx={lensX} cy={70} rx={12} ry={60} className="fig-lens" />
      <text x={440} y={108} textAnchor="middle" className="fig-text small">
        青は手前、赤は奥に集まる
      </text>
    </svg>
  );
}

export function Spherical() {
  const lensX = 180;
  const rays = [
    { h: 56, fx: 400 },
    { h: 38, fx: 435 },
    { h: 18, fx: 465 },
  ];
  return (
    <svg className="figure" viewBox="0 0 600 140" role="img" aria-label="レンズの端を通る光ほど手前に集まる図">
      {rays.map((r) => (
        <g key={r.h}>
          {[-1, 1].map((sign) => (
            <g key={sign}>
              <line x1={20} y1={70 + sign * r.h} x2={lensX} y2={70 + sign * r.h} className="fig-ray-y" />
              <line x1={lensX} y1={70 + sign * r.h} x2={r.fx} y2={70} className="fig-ray-y" />
            </g>
          ))}
        </g>
      ))}
      <ellipse cx={lensX} cy={70} rx={14} ry={62} className="fig-lens" />
      <text x={400} y={96} textAnchor="middle" className="fig-text small">
        端の光
      </text>
      <text x={475} y={96} textAnchor="middle" className="fig-text small">
        中心の光
      </text>
    </svg>
  );
}

export function Distortion() {
  const grid = (k: number, ox: number, label: string) => {
    const size = 150;
    const cx = ox + size / 2;
    const cy = 78;
    const lines: string[] = [];
    const map = (u: number, v: number) => {
      const r2 = u * u + v * v;
      const s = 1 + k * r2;
      return `${(cx + u * s * (size / 2)).toFixed(1)},${(cy + v * s * (size / 2)).toFixed(1)}`;
    };
    for (let i = -3; i <= 3; i++) {
      const a: string[] = [];
      const b: string[] = [];
      for (let t = -10; t <= 10; t++) {
        a.push(map(i / 3, t / 10));
        b.push(map(t / 10, i / 3));
      }
      lines.push(a.join(' '), b.join(' '));
    }
    return (
      <g key={label}>
        {lines.map((l, i) => (
          <polyline key={i} points={l} className="fig-grid-line" />
        ))}
        <text x={cx} y={172} textAnchor="middle" className="fig-text small">
          {label}
        </text>
      </g>
    );
  };
  return (
    <svg className="figure" viewBox="0 0 600 180" role="img" aria-label="歪みなし、樽型、糸巻き型の格子">
      {grid(0, 20, '歪みなし')}
      {grid(-0.14, 225, '樽型')}
      {grid(0.14, 430, '糸巻き型')}
    </svg>
  );
}

export function Diffraction() {
  const fs = [4, 8, 16, 22];
  const umToPx = 3.2; // 1µm を何pxで描くか
  return (
    <svg className="figure" viewBox="0 0 600 140" role="img" aria-label="F値ごとの回折のにじみの大きさ">
      <defs>
        <radialGradient id="airy">
          <stop offset="0%" stopColor="#fff6da" />
          <stop offset="55%" stopColor="#f2b134" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f2b134" stopOpacity="0" />
        </radialGradient>
      </defs>
      {fs.map((f, i) => {
        const d = airyDiskMm(f) * 1000;
        const cx = 80 + i * 145;
        return (
          <g key={f}>
            <circle cx={cx} cy={60} r={(d * umToPx) / 2} fill="url(#airy)" />
            <rect x={cx - 3 * umToPx} y={60 - 3 * umToPx} width={6 * umToPx} height={6 * umToPx} className="fig-pixel" />
            <text x={cx} y={118} textAnchor="middle" className="fig-text strong">
              F{f}
            </text>
            <text x={cx} y={134} textAnchor="middle" className="fig-text small">
              ⌀{d.toFixed(0)}µm
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 羽毛の細かい線を持つ鳥を描く。枠の大きさに合わせて描くので、画素が少ないと細部がつぶれる */
function drawBird(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#7fa8c9';
  ctx.fillRect(0, 0, w, h);
  const u = w / 100;
  ctx.fillStyle = '#6b4a30';
  ctx.fillRect(0, h * 0.74, w, 2.4 * u);
  ctx.translate(w * 0.5, h * 0.5);
  ctx.fillStyle = '#c98a4b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22 * u, 13 * u, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9a766';
  ctx.beginPath();
  ctx.arc(19 * u, -10 * u, 8 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.moveTo(26 * u, -11 * u);
  ctx.lineTo(33 * u, -9 * u);
  ctx.lineTo(26 * u, -7 * u);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-18 * u, 2 * u);
  ctx.lineTo(-38 * u, 8 * u);
  ctx.lineTo(-20 * u, 8 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(21 * u, -11.5 * u, 1.3 * u, 0, Math.PI * 2);
  ctx.fill();
  // 羽毛の模様
  ctx.strokeStyle = '#6b4526';
  ctx.lineWidth = Math.max(0.4, 0.35 * u);
  for (let i = 0; i < 46; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = 11 * Math.sqrt(i / 46);
    const px = (Math.cos(a) * r * 1.9 - 2) * u;
    const py = Math.sin(a) * r * u;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 3.2 * u, py + 0.9 * u);
    ctx.stroke();
  }
  ctx.restore();
}

/** 同じレンズ・同じ距離で撮ったときの1枚分のカード */
function CropCard({ title, body, crop, birdMm }: { title: string; body: Body; crop: number; birdMm: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const birdPx = birdMm * pixelsPerMm(body);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // 鳥の長さ = 枠の幅の 7割として、実際に載る画素数で描いてから拡大する
    const w = Math.max(8, Math.round(birdPx / 0.7));
    const h = Math.round((w * 2) / 3);
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    drawBird(small.getContext('2d')!, w, h);
    canvas.width = 480;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, 480, 320);
  }, [birdPx]);
  return (
    <div className="crop-card">
      <h5>{title}</h5>
      <canvas ref={ref} />
      <dl>
        <dt>鳥に載る画素</dt>
        <dd>{Math.round(birdPx)}px</dd>
        <dt>写真全体の画素数</dt>
        <dd>{croppedMegapixels(body, crop).toFixed(1)}MP</dd>
        <dt>画素ピッチ</dt>
        <dd>{pixelPitch(body).toFixed(1)}µm</dd>
        <dt>センサー上の鳥</dt>
        <dd>{birdMm.toFixed(2)}mm</dd>
      </dl>
    </div>
  );
}

export function CropDemo() {
  const [focal, setFocal] = useState(300);
  const [distance, setDistance] = useState(200);
  const birdMm = (focal * 0.2) / distance; // 体長20cmの鳥
  const ff24 = getBody('ff-24');
  const apsc = getBody('apsc-24');
  const ff45 = getBody('ff-45');
  const crop = ff24.width / apsc.width;
  return (
    <div className="crop-demo">
      <div className="crop-demo-controls">
        <label>
          <span>
            焦点距離 <b>{focal}mm</b>
          </span>
          <input type="range" min={100} max={600} step={50} value={focal} onChange={(e) => setFocal(Number(e.target.value))} />
        </label>
        <label>
          <span>
            鳥までの距離 <b>{distance}m</b>
          </span>
          <input type="range" min={20} max={300} step={5} value={distance} onChange={(e) => setDistance(Number(e.target.value))} />
        </label>
      </div>
      <div className="crop-cards">
        <CropCard title="フルサイズ 2400万画素 → トリミング" body={ff24} crop={crop} birdMm={birdMm} />
        <CropCard title="APS-C 2400万画素" body={apsc} crop={1} birdMm={birdMm} />
        <CropCard title="フルサイズ 4500万画素 → トリミング" body={ff45} crop={crop} birdMm={birdMm} />
      </div>
    </div>
  );
}
