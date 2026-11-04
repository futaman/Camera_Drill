// ファインダー周りの表示: 情報バー（露出計つき）、ヒストグラム、被写界深度バー。

import { F_STOPS, ISO_STOPS, SS_STOPS, formatStops, polar } from '../physics';
import { SHARP_PX } from '../store/analysis';
import { useAnalysis, useRig, useTelemetry } from './RigContext';

/** カメラの露出計（−3〜+3段） */
export function ExposureMeter({ stops }: { stops: number }) {
  const clamped = Math.max(-3.2, Math.min(3.2, stops));
  const ticks = [];
  for (let i = -9; i <= 9; i++) {
    ticks.push(
      <span key={i} className={`em-tick ${i % 3 === 0 ? 'major' : ''}`} style={{ left: `${50 + (i / 9) * 46}%` }}>
        {i % 3 === 0 && <b>{i === 0 ? '0' : Math.abs(i / 3)}</b>}
      </span>,
    );
  }
  return (
    <div className="exposure-meter" title="測光した明るさに対して、何段明るく（+）／暗く（−）写るか">
      <span className="em-sign">−</span>
      <div className="em-scale">
        {ticks}
        <span className={`em-needle ${Math.abs(stops) > 3 ? 'over' : ''}`} style={{ left: `${50 + (clamped / 3) * 46}%` }} />
      </div>
      <span className="em-sign">+</span>
    </div>
  );
}

export function InfoBar() {
  const rig = useRig((r) => r);
  const tel = useTelemetry();
  return (
    <div className="info-bar">
      <span className="ib-item ib-mode">{rig.mode}</span>
      <span className="ib-item">
        <small>SS</small>
        {SS_STOPS[rig.ssIndex].label}
      </span>
      <span className="ib-item">
        <small>F</small>
        {F_STOPS[rig.fIndex].label}
      </span>
      <span className="ib-item">
        <small>ISO</small>
        {ISO_STOPS[rig.isoIndex].label}
      </span>
      <span className="ib-item">
        <small>焦点距離</small>
        {Math.round(rig.focal)}mm
      </span>
      <ExposureMeter stops={tel?.meterStops ?? 0} />
      <span className="ib-item ib-ev">{tel ? formatStops(tel.meterStops) : '—'}</span>
    </div>
  );
}

export function Histogram() {
  const tel = useTelemetry();
  const bins = tel?.histogram ?? new Array(64).fill(0);
  const peak = Math.max(...bins, 1e-6);
  const clipped = (tel?.clippedRatio ?? 0) > 0.003;
  const crushed = (tel?.crushedRatio ?? 0) > 0.02;
  const pct = (r: number) => (r < 0.01 ? '1%未満' : `${Math.round(r * 100)}%`);
  return (
    <div className="histogram">
      <div className="hist-head">
        <span>ヒストグラム</span>
        <span className="hist-flags">
          {crushed && <em className="flag dark">黒つぶれ {pct(tel?.crushedRatio ?? 0)}</em>}
          {clipped && <em className="flag bright">白飛び {pct(tel?.clippedRatio ?? 0)}</em>}
        </span>
      </div>
      <svg viewBox="0 0 64 32" preserveAspectRatio="none">
        <rect x="0" y="0" width="64" height="32" className="hist-bg" />
        {[16, 32, 48].map((x) => (
          <line key={x} x1={x} x2={x} y1={0} y2={32} className="hist-grid" />
        ))}
        {bins.map((b, i) => {
          const h = Math.sqrt(b / peak) * 31;
          return <rect key={i} x={i} y={32 - h} width={1} height={h} className="hist-bar" />;
        })}
      </svg>
      <div className="hist-axis">
        <span>暗い</span>
        <span>明るい</span>
      </div>
    </div>
  );
}

/** 上から見た図。カメラ・被写体・背景の位置と画角を示す（距離は対数ではなく実距離） */
export function TopView() {
  const sceneId = useRig((r) => r.sceneId);
  return sceneId === 'studio' ? <StudioDiagram /> : <CameraTopView />;
}

/** スタジオのライトの配置を上から見た図と、光の明暗差 */
function StudioDiagram() {
  const a = useAnalysis();
  const p = a.params;
  const W = 640;
  const H = 150;
  const cx = W / 2;
  const cy = 62;
  const scale = 21;
  // 方位角 0 がカメラ側（図の下）
  const at = (az: number, d: number) => {
    const q = polar(az, 0, d);
    return { x: cx + q.x * scale, y: cy + q.z * scale };
  };
  const key = at(p.keyAz, p.keyDist * Math.cos((p.keyEl * Math.PI) / 180));
  const refl = at(p.reflAz, p.reflDist);
  const cam = at(0, Math.min(p.distance, 3.8));
  const reflOn = p.reflector > 0;
  return (
    <div className="top-view">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ライトとレフ板の配置を上から見た図">
        <line x1={key.x} y1={key.y} x2={cx} y2={cy} className="tv-beam" />
        {reflOn && <line x1={key.x} y1={key.y} x2={refl.x} y2={refl.y} className="tv-beam thin" />}
        {reflOn && <line x1={refl.x} y1={refl.y} x2={cx} y2={cy} className="tv-beam thin" />}
        <circle cx={cx} cy={cy} r={6} className="tv-subject" />
        <rect x={cam.x - 7} y={cam.y - 5} width={14} height={10} rx={2} className="tv-cam-studio" />
        <circle cx={key.x} cy={key.y} r={Math.max(4, (p.keySize / 2) * scale)} className="tv-key" />
        {reflOn && <circle cx={refl.x} cy={refl.y} r={8} className={p.reflector === 3 ? 'tv-refl black' : 'tv-refl'} />}
        <text x={key.x} y={key.y - 8} textAnchor="middle" className="tv-text">
          キー
        </text>
        {reflOn && (
          <text x={refl.x} y={refl.y - 11} textAnchor="middle" className="tv-text">
            レフ板
          </text>
        )}
        <text x={cam.x + 11} y={cam.y + 4} className="tv-text">
          カメラ
        </text>
      </svg>
      {a.studio && (
        <div className="dof-legend">
          <span>
            明暗差 <b>{a.studio.ratioStops.toFixed(1)}段</b>（当たる側 {Math.round(a.studio.keyLx + a.studio.fillLx)}lx / 影の側{' '}
            {Math.round(a.studio.fillLx)}lx）
          </span>
          <span className="muted">レフ板が返す光 {Math.round(a.studio.reflectorLx)}lx</span>
        </div>
      )}
    </div>
  );
}

function CameraTopView() {
  const a = useAnalysis();
  const hasColumns = useRig((r) => r.sceneId === 'garden');
  const camD = a.cameraDistance;
  const subject = a.distances.subject;
  if (!a.ready || !camD || subject === undefined) return <div className="top-view" />;
  const W = 640;
  const H = 110;
  const camX = 24;
  const cy = H / 2;
  // 被写体の奥36mまで描く。庭園シーンでは6m間隔の列柱が距離の目盛りになる
  const range = subject + 36;
  const scale = (W - camX - 12) / range;
  const half = (a.horizontalAov * Math.PI) / 360;
  const spread = Math.tan(half) * (W - camX);
  const subjectX = camX + subject * scale;
  const widthAtSubject = 2 * Math.tan(half) * subject;
  return (
    <div className="top-view">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="上から見たカメラと被写体の位置">
        <polygon points={`${camX},${cy} ${W},${cy - spread} ${W},${cy + spread}`} className="tv-fov" />
        <line x1={0} y1={cy} x2={W} y2={cy} className="tv-axis" />
        {hasColumns &&
          Array.from({ length: 6 }, (_, i) => {
            const x = subjectX + (i + 1) * 6 * scale;
            return x < W ? (
              <g key={i}>
                <circle cx={x} cy={cy - 3.2 * scale} r={2.5} className="tv-column" />
                <circle cx={x} cy={cy + 3.2 * scale} r={2.5} className="tv-column" />
              </g>
            ) : null;
          })}
        <rect x={camX - 12} y={cy - 7} width={12} height={14} rx={2} className="tv-camera" />
        <circle cx={subjectX} cy={cy} r={5} className="tv-subject" />
        <text x={subjectX} y={cy + 22} textAnchor="middle" className="tv-text">
          胸像 {subject.toFixed(1)}m
        </text>
      </svg>
      <div className="dof-legend">
        <span>
          画角 {a.horizontalAov.toFixed(1)}°（35mm判換算 {Math.round(a.equivalentFocal)}mm）
        </span>
        <span className="muted">
          被写体の位置で写る幅 {widthAtSubject.toFixed(1)}m{hasColumns && ' / 柱は6m間隔'}
        </span>
      </div>
    </div>
  );
}

const BAR_MIN = 0.3;
const BAR_MAX = 30;
const pos = (m: number) =>
  `${(Math.log(Math.min(BAR_MAX, Math.max(BAR_MIN, m)) / BAR_MIN) / Math.log(BAR_MAX / BAR_MIN)) * 100}%`;

/** 距離の目盛り上に、ピントの合う範囲と被写体・背景の位置を示す */
export function DofBar() {
  const a = useAnalysis();
  if (!a.ready) return <div className="dof-bar" />;
  const far = Number.isFinite(a.dof.far) ? a.dof.far : BAR_MAX;
  const markers: { id: string; label: string }[] = [
    { id: 'foreground', label: '手前' },
    { id: 'subject', label: '被写体' },
    { id: 'background', label: '背景' },
  ];
  return (
    <div className="dof-bar">
      <div className="dof-track">
        <div className="dof-range" style={{ left: pos(a.dof.near), width: `calc(${pos(far)} - ${pos(a.dof.near)})` }} />
        <div className="dof-focus" style={{ left: pos(a.focusM) }} />
        {[0.5, 1, 2, 5, 10, 20].map((m) => (
          <span key={m} className="dof-scale" style={{ left: pos(m) }}>
            {m}m
          </span>
        ))}
        {markers
          .filter((m) => a.distances[m.id] !== undefined && a.distances[m.id] > 0)
          .map((m) => {
            const c = Math.abs(a.coc[m.id] ?? 0);
            return (
              <span key={m.id} className={`dof-marker ${c <= SHARP_PX ? 'sharp' : ''}`} style={{ left: pos(a.distances[m.id]) }}>
                <i />
                {m.label}
                <small>ボケ {c < 0.95 ? '0' : c.toFixed(c < 10 ? 1 : 0)}px</small>
              </span>
            );
          })}
      </div>
      <div className="dof-legend">
        <span>
          ピントの合う範囲: {a.dof.near.toFixed(2)}m 〜 {Number.isFinite(a.dof.far) ? `${a.dof.far.toFixed(2)}m` : '∞'}
        </span>
        <span className="muted">ボケの大きさは横1000pxの写真に換算した直径</span>
      </div>
    </div>
  );
}
