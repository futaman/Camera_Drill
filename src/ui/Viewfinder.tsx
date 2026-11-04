import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Engine } from '../render/Engine';
import { engineSettings } from '../store/analysis';
import { useSettings } from '../store/settings';
import { useEngineRef, useRig, useRigApi, useSetTelemetry } from './RigContext';

/** ライブビュー。クリックした位置にAFポイントを移す */
export function Viewfinder({ capturing = false }: { capturing?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const rigApi = useRigApi();
  const engineRef = useEngineRef();
  const setTelemetry = useSetTelemetry();
  const [error, setError] = useState<string | null>(null);
  const afPoint = useRig((r) => r.afPoint);
  const focusMode = useRig((r) => r.focusMode);
  const grid = useSettings((s) => s.grid);

  useEffect(() => {
    // コンテキストを解放したキャンバスは使い回せないので、マウントごとに作る
    const canvas = document.createElement('canvas');
    boxRef.current!.prepend(canvas);
    let engine: Engine;
    try {
      engine = new Engine(canvas);
    } catch (e) {
      setError('WebGL2 を初期化できませんでした。最新の Chrome / Edge でお試しください。');
      console.error(e);
      canvas.remove();
      return;
    }
    engineRef.current = engine;
    const push = () => engine.setSettings(engineSettings(rigApi.getState(), useSettings.getState()));
    push();
    const unsubRig = rigApi.subscribe(push);
    const unsubSettings = useSettings.subscribe(push);
    const unsubTel = engine.onTelemetry(setTelemetry);

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      engine.resize(width, height);
    });
    ro.observe(boxRef.current!);
    engine.start();

    return () => {
      ro.disconnect();
      unsubRig();
      unsubSettings();
      unsubTel();
      engine.dispose();
      engineRef.current = null;
      canvas.remove();
    };
  }, [rigApi, engineRef, setTelemetry]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (focusMode !== 'af') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    rigApi.getState().update({ afPoint: [x, y] });
  };

  return (
    <div className="viewfinder" ref={boxRef} onClick={onClick}>
      {grid && <div className="vf-grid" />}
      {focusMode === 'af' && (
        <div className="vf-af" style={{ left: `${afPoint[0] * 100}%`, top: `${afPoint[1] * 100}%` }} />
      )}
      {focusMode === 'af' && <div className="vf-hint">クリックでピント位置（AFポイント）を移動</div>}
      {capturing && <div className="vf-capturing">撮影中…</div>}
      {error && <div className="vf-error">{error}</div>}
    </div>
  );
}
