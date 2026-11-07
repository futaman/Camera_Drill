// 講座の図解（ライティング）。

/** 光源が小さいと影の縁はくっきり、大きいとなだらかになる */
export function LightSize() {
  const rows = [
    { x: 150, r: 5, label: '小さい光源 → 硬い光' },
    { x: 450, r: 42, label: '大きい光源 → やわらかい光' },
  ];
  return (
    <svg className="figure" viewBox="0 0 600 170" role="img" aria-label="光源の大きさと影の縁の違い">
      {rows.map((row) => {
        const lightY = 22;
        const objY = 88;
        const groundY = 132;
        const objR = 16;
        const edge = (lx: number, ox: number) => lx + ((ox - lx) * (groundY - lightY)) / (objY - lightY);
        // 本影（どこからも光が届かない）と半影（一部の光が届く）
        const umbraL = edge(row.x - row.r, row.x - objR);
        const umbraR = edge(row.x + row.r, row.x + objR);
        const penumbraL = edge(row.x + row.r, row.x - objR);
        const penumbraR = edge(row.x - row.r, row.x + objR);
        return (
          <g key={row.label}>
            <ellipse cx={row.x} cy={lightY} rx={row.r} ry={5} className="fig-light-src" />
            <line x1={row.x - row.r} y1={lightY} x2={penumbraR} y2={groundY} className="fig-ray" />
            <line x1={row.x + row.r} y1={lightY} x2={penumbraL} y2={groundY} className="fig-ray" />
            <circle cx={row.x} cy={objY} r={objR} className="tv-subject" />
            <rect x={penumbraL} y={groundY} width={penumbraR - penumbraL} height={7} className="fig-penumbra" />
            {umbraR > umbraL && <rect x={umbraL} y={groundY} width={umbraR - umbraL} height={7} className="fig-umbra" />}
            <text x={row.x} y={160} textAnchor="middle" className="fig-text small">
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 光の向きによる呼び名を上から見た図 */
export function LightAngles() {
  const cx = 300;
  const cy = 88;
  const R = 68;
  const items = [
    { az: 0, label: '順光' },
    { az: 45, label: '斜光' },
    { az: 90, label: 'サイド光' },
    { az: 150, label: '半逆光' },
    { az: 180, label: '逆光' },
  ];
  return (
    <svg className="figure" viewBox="0 0 600 185" role="img" aria-label="光の向きの呼び名">
      <circle cx={cx} cy={cy} r={R} className="fig-orbit" />
      <circle cx={cx} cy={cy} r={8} className="tv-subject" />
      {items.map((it) => {
        const a = (it.az * Math.PI) / 180;
        const x = cx + Math.sin(a) * R;
        const y = cy + Math.cos(a) * R;
        return (
          <g key={it.label}>
            <line x1={x} y1={y} x2={cx} y2={cy} className="fig-ray" />
            <circle cx={x} cy={y} r={5} className="fig-light-src" />
            <text x={x + 10} y={y + (it.az === 180 ? -2 : 12)} className="fig-text small">
              {it.label}（{it.az}°）
            </text>
          </g>
        );
      })}
      <text x={cx - 12} y={cy + R + 22} textAnchor="end" className="fig-text small">
        カメラ側
      </text>
    </svg>
  );
}

/** 逆二乗の法則: 距離が2倍で明るさは 1/4 */
export function InverseSquare() {
  const rows = [
    { d: 1, lx: 8000 },
    { d: 2, lx: 2000 },
    { d: 4, lx: 500 },
  ];
  const scale = 95;
  return (
    <svg className="figure" viewBox="0 0 600 130" role="img" aria-label="距離と明るさの関係">
      <circle cx={30} cy={56} r={8} className="fig-light-src" />
      {rows.map((r) => {
        const x = 30 + r.d * scale;
        const h = 14 * r.d;
        return (
          <g key={r.d}>
            <line x1={30} y1={56} x2={x} y2={56 - h} className="fig-ray" />
            <line x1={30} y1={56} x2={x} y2={56 + h} className="fig-ray" />
            <line x1={x} y1={56 - h} x2={x} y2={56 + h} className="fig-bg-line" />
            <text x={x} y={114} textAnchor="middle" className="fig-text strong">
              {r.d}m
            </text>
            <text x={x} y={128} textAnchor="middle" className="fig-text small accent">
              {r.lx}lx
            </text>
          </g>
        );
      })}
    </svg>
  );
}
