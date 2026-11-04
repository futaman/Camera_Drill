// 講座の図解（SVG）。

import { useState } from 'react';
import type { FigureId } from '../../lessons/types';
import { Chromatic, Compression, CropDemo, Diffraction, Distortion, EvScale, LogCurve, Modes, Sensors, Spherical } from './Figures2';

export function Figure({ id }: { id: FigureId }) {
  switch (id) {
    case 'pipeline':
      return <Pipeline />;
    case 'stops':
      return <Stops />;
    case 'aperture':
      return <Aperture />;
    case 'equivalent':
      return <Equivalent />;
    case 'coc':
      return <Coc />;
    case 'focal':
      return <Focal />;
    case 'sensors':
      return <Sensors />;
    case 'compression':
      return <Compression />;
    case 'ev':
      return <EvScale />;
    case 'modes':
      return <Modes />;
    case 'log':
      return <LogCurve />;
    case 'chromatic':
      return <Chromatic />;
    case 'spherical':
      return <Spherical />;
    case 'distortion':
      return <Distortion />;
    case 'diffraction':
      return <Diffraction />;
    case 'cropDemo':
      return <CropDemo />;
  }
}

function Pipeline() {
  const boxes = [
    { x: 10, label: '光', sub: '被写体から' },
    { x: 130, label: 'レンズ', sub: 'F値（絞り）' },
    { x: 250, label: 'シャッター', sub: '開いている時間' },
    { x: 370, label: 'センサー', sub: '光の量を記録' },
    { x: 490, label: '増幅', sub: 'ISO感度' },
  ];
  return (
    <svg className="figure" viewBox="0 0 600 110" role="img" aria-label="光がレンズ、シャッター、センサー、増幅を通って写真になる流れ">
      {boxes.map((b, i) => (
        <g key={b.label}>
          <rect x={b.x} y={20} width={100} height={60} rx={8} className={i === 0 ? 'fig-light' : 'fig-box'} />
          <text x={b.x + 50} y={47} className="fig-text strong" textAnchor="middle">
            {b.label}
          </text>
          <text x={b.x + 50} y={66} className="fig-text small" textAnchor="middle">
            {b.sub}
          </text>
          {i < boxes.length - 1 && <path d={`M${b.x + 104} 50 l12 0 m-5 -5 l5 5 l-5 5`} className="fig-arrow" />}
        </g>
      ))}
      <text x={130 + 50} y={100} className="fig-text small accent" textAnchor="middle">
        → ボケ
      </text>
      <text x={250 + 50} y={100} className="fig-text small accent" textAnchor="middle">
        → ブレ
      </text>
      <text x={490 + 50} y={100} className="fig-text small accent" textAnchor="middle">
        → ノイズ
      </text>
    </svg>
  );
}

function Stops() {
  const steps = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <svg className="figure" viewBox="0 0 600 120" role="img" aria-label="1段ごとに光の量が2倍になる図">
      {steps.map((s, i) => {
        const amount = 2 ** s;
        const gray = Math.round(Math.min(1, 0.18 * amount) ** (1 / 2.2) * 255);
        return (
          <g key={s}>
            <rect x={20 + i * 82} y={14} width={70} height={50} rx={6} fill={`rgb(${gray},${gray},${gray})`} className="fig-swatch" />
            <text x={55 + i * 82} y={84} className="fig-text strong" textAnchor="middle">
              {s > 0 ? `+${s}` : s}段
            </text>
            <text x={55 + i * 82} y={104} className="fig-text small" textAnchor="middle">
              光 ×{amount >= 1 ? amount : `1/${1 / amount}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Aperture() {
  const fs = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
  return (
    <svg className="figure" viewBox="0 0 600 130" role="img" aria-label="F値ごとの絞りの穴の大きさ">
      {fs.map((f, i) => {
        const r = 34 * (1.4 / f);
        const cx = 40 + i * 74;
        return (
          <g key={f}>
            <circle cx={cx} cy={52} r={36} className="fig-barrel" />
            <circle cx={cx} cy={52} r={r} className="fig-hole" />
            <text x={cx} y={112} className="fig-text strong" textAnchor="middle">
              F{f}
            </text>
          </g>
        );
      })}
      <text x={590} y={128} className="fig-text small" textAnchor="end">
        右に1つ進むごとに穴の面積が半分（1段暗い）
      </text>
    </svg>
  );
}

function Equivalent() {
  const rows = [
    ['F2.8', '1/250', '400'],
    ['F4', '1/125', '400'],
    ['F5.6', '1/60', '400'],
    ['F5.6', '1/125', '800'],
    ['F8', '1/60', '800'],
  ];
  return (
    <table className="figure-table">
      <caption>すべて同じ明るさになる組み合わせ</caption>
      <thead>
        <tr>
          <th>F値</th>
          <th>シャッタースピード</th>
          <th>ISO</th>
          <th>特徴</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r[0]}</td>
            <td>{r[1]}</td>
            <td>{r[2]}</td>
            <td className="muted">
              {i === 0 ? 'ボケが大きい・ブレにくい' : i === 4 ? 'ボケが小さい・ノイズ多め' : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 錯乱円の図。F値のスライダーで穴の大きさと円の大きさの関係を見せる */
function Coc() {
  const [n, setN] = useState(2);
  const lensX = 150;
  const sensorX = 470;
  const half = 60 / n; // 穴の半径（図の単位）
  const focusY = 70;
  // 奥の点の光は、センサーより手前で1点に集まってから広がる
  const convergeX = 410;
  const spread = (half * (sensorX - convergeX)) / (convergeX - lensX);
  return (
    <div className="figure-wrap">
      <svg className="figure" viewBox="0 0 600 150" role="img" aria-label="ピントのずれた点がセンサー上で円に広がる図">
        <line x1={20} y1={focusY} x2={580} y2={focusY} className="fig-axis" />
        <text x={40} y={focusY - 8} className="fig-text small">
          奥の点
        </text>
        <circle cx={30} cy={focusY} r={4} className="fig-point" />
        <polygon points={`30,${focusY} ${lensX},${focusY - half} ${lensX},${focusY + half}`} className="fig-cone" />
        <polygon
          points={`${lensX},${focusY - half} ${lensX},${focusY + half} ${convergeX},${focusY}`}
          className="fig-cone"
        />
        <polygon
          points={`${convergeX},${focusY} ${sensorX},${focusY - spread} ${sensorX},${focusY + spread}`}
          className="fig-cone"
        />
        <ellipse cx={lensX} cy={focusY} rx={10} ry={62} className="fig-lens" />
        <rect x={lensX - 3} y={focusY - 66} width={6} height={66 - half} className="fig-blade" />
        <rect x={lensX - 3} y={focusY + half} width={6} height={66 - half} className="fig-blade" />
        <line x1={sensorX} y1={8} x2={sensorX} y2={132} className="fig-sensor" />
        <line x1={sensorX + 8} y1={focusY - spread} x2={sensorX + 8} y2={focusY + spread} className="fig-coc" />
        <text x={lensX} y={146} className="fig-text small" textAnchor="middle">
          絞り（F{n}）
        </text>
        <text x={sensorX} y={146} className="fig-text small" textAnchor="middle">
          センサー
        </text>
        <text x={sensorX + 16} y={focusY + 4} className="fig-text small accent">
          錯乱円
        </text>
      </svg>
      <label className="figure-control">
        F値 <b>F{n}</b>
        <input type="range" min={1.4} max={8} step={0.1} value={n} onChange={(e) => setN(Number(e.target.value))} />
      </label>
    </div>
  );
}

function Focal() {
  const items = [
    { f: 24, d: 24 / 2.8 },
    { f: 50, d: 50 / 2.8 },
    { f: 70, d: 70 / 2.8 },
  ];
  return (
    <svg className="figure" viewBox="0 0 600 120" role="img" aria-label="同じF2.8でも焦点距離が長いほど穴が大きい">
      {items.map((it, i) => {
        const cx = 100 + i * 200;
        return (
          <g key={it.f}>
            <circle cx={cx} cy={50} r={40} className="fig-barrel" />
            <circle cx={cx} cy={50} r={it.d * 1.4} className="fig-hole" />
            <text x={cx} y={106} className="fig-text strong" textAnchor="middle">
              {it.f}mm F2.8
            </text>
            <text x={cx + 46} y={30} className="fig-text small">
              ⌀{it.d.toFixed(1)}mm
            </text>
          </g>
        );
      })}
    </svg>
  );
}
