import { useCallback, useEffect, useState } from 'react';
import { F_STOPS, ISO_STOPS, SS_STOPS, formatStops } from '../physics';
import { getScene } from '../scenes';
import { useSimulatorRig } from '../store/rig';
import { useSettings } from '../store/settings';
import { ControlPanel } from './ControlPanel';
import { DofBar, Histogram, InfoBar } from './Readouts';
import { RigProvider, useEngineRef, useRigApi } from './RigContext';
import { Viewfinder } from './Viewfinder';

interface Shot {
  id: number;
  dataUrl: string;
  caption: string;
  detail: string;
}

const MAX_SHOTS = 8;

export function SimulatorPage() {
  return (
    <RigProvider rig={useSimulatorRig}>
      <Simulator />
    </RigProvider>
  );
}

function Simulator() {
  const engineRef = useEngineRef();
  const rigApi = useRigApi();
  const dofBar = useSettings((s) => s.dofBar);
  const [capturing, setCapturing] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [viewing, setViewing] = useState<number[]>([]);

  const shoot = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || capturing) return;
    setCapturing(true);
    await new Promise((r) => setTimeout(r, 30));
    const { dataUrl, telemetry } = await engine.capture();
    const r = rigApi.getState();
    const shot: Shot = {
      id: Date.now(),
      dataUrl,
      caption: `F${F_STOPS[r.fIndex].label}  ${SS_STOPS[r.ssIndex].label}  ISO${ISO_STOPS[r.isoIndex].label}  ${Math.round(r.focal)}mm`,
      detail: `${getScene(r.sceneId).name} / 露出 ${formatStops(telemetry.meterStops)}段 / ピント ${telemetry.focusM.toFixed(2)}m`,
    };
    setShots((s) => [shot, ...s].slice(0, MAX_SHOTS));
    setViewing([shot.id]);
    setCapturing(false);
  }, [engineRef, rigApi, capturing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
        e.preventDefault();
        void shoot();
      }
      if (e.code === 'Escape') setViewing([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shoot]);

  const toggleCompare = (id: number) =>
    setViewing((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id].slice(-2)));

  const viewed = viewing.map((id) => shots.find((s) => s.id === id)).filter((s): s is Shot => !!s);

  return (
    <div className="sim">
      <div className="sim-main">
        <Viewfinder capturing={capturing} />
        <InfoBar />
        {dofBar && <DofBar />}
        {shots.length > 0 && (
          <div className="shot-strip">
            <span className="muted">撮った写真（クリックで表示、2枚選ぶと比較）</span>
            <div className="shot-thumbs">
              {shots.map((s) => (
                <button
                  key={s.id}
                  className={`shot-thumb ${viewing.includes(s.id) ? 'on' : ''}`}
                  onClick={() => toggleCompare(s.id)}
                  title={s.caption}
                >
                  <img src={s.dataUrl} alt={s.caption} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <aside className="sim-side">
        <button className="shutter" onClick={() => void shoot()} disabled={capturing}>
          {capturing ? '撮影中…' : 'シャッター'}
          <small>Space</small>
        </button>
        <Histogram />
        <ControlPanel />
      </aside>

      {viewed.length > 0 && (
        <div className="shot-viewer" onClick={() => setViewing([])}>
          <div className={`shot-viewer-inner n${viewed.length}`} onClick={(e) => e.stopPropagation()}>
            {viewed.map((s) => (
              <figure key={s.id}>
                <img src={s.dataUrl} alt={s.caption} />
                <figcaption>
                  <b>{s.caption}</b>
                  <span>{s.detail}</span>
                </figcaption>
              </figure>
            ))}
            <div className="shot-viewer-actions">
              <div className="shot-thumbs">
                {shots.map((s) => (
                  <button
                    key={s.id}
                    className={`shot-thumb ${viewing.includes(s.id) ? 'on' : ''}`}
                    onClick={() => toggleCompare(s.id)}
                    title={s.caption}
                  >
                    <img src={s.dataUrl} alt={s.caption} />
                  </button>
                ))}
              </div>
              <span className="muted">2枚選ぶと並べて比較。Esc で閉じる</span>
              <button onClick={() => setViewing([])}>ライブビューに戻る</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
