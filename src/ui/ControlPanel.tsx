import { LENSES, getLens, minFIndex } from '../camera/lenses';
import { F_STOPS, ISO_NATIVE_MAX, ISO_NATIVE_MIN, ISO_STOPS, SS_STOPS } from '../physics';
import { SCENES, getScene } from '../scenes';
import { StopControl } from './controls/StopControl';
import { useRig, useRigApi, useTelemetry } from './RigContext';

export type ControlId =
  | 'f'
  | 'ss'
  | 'iso'
  | 'lens'
  | 'focal'
  | 'focus'
  | 'stabilization'
  | 'tripod'
  | 'scene'
  | 'lighting'
  | 'params';

export const ALL_CONTROLS: ControlId[] = [
  'f', 'ss', 'iso', 'lens', 'focal', 'focus', 'stabilization', 'tripod', 'scene', 'lighting', 'params',
];

/** MFの距離スライダーは対数目盛り（0〜1 ↔ 最短撮影距離〜20m） */
const MF_FAR = 20;
const toSlider = (m: number, min: number) => Math.log(m / min) / Math.log(MF_FAR / min);
const fromSlider = (v: number, min: number) => min * (MF_FAR / min) ** v;

export function ControlPanel({ controls = ALL_CONTROLS }: { controls?: ControlId[] }) {
  const rig = useRig((r) => r);
  const api = useRigApi();
  const tel = useTelemetry();
  const has = (id: ControlId) => controls.includes(id);
  const lens = getLens(rig.lensId);
  const scene = getScene(rig.sceneId);
  const isoNative = (i: number) => ISO_STOPS[i].value >= ISO_NATIVE_MIN - 1 && ISO_STOPS[i].value <= ISO_NATIVE_MAX + 1;
  const isoMin = ISO_STOPS.findIndex((_, i) => isoNative(i));

  const exposure = has('f') || has('ss') || has('iso');
  const optics = has('lens') || has('focal') || has('focus');
  const support = has('stabilization') || has('tripod');
  const sceneCtl = has('scene') || has('lighting') || (has('params') && scene.params.length > 0);

  return (
    <div className="control-panel">
      {exposure && (
        <section>
          <h3>露出</h3>
          {has('f') && (
            <StopControl
              label="F値"
              sub="絞り"
              stops={F_STOPS}
              index={rig.fIndex}
              min={minFIndex(lens, rig.focal)}
              format={(s) => `F${s.label}`}
              onChange={(i) => api.getState().update({ fIndex: i })}
            />
          )}
          {has('ss') && (
            <StopControl
              label="シャッタースピード"
              stops={SS_STOPS}
              index={rig.ssIndex}
              onChange={(i) => api.getState().update({ ssIndex: i })}
            />
          )}
          {has('iso') && (
            <StopControl
              label="ISO感度"
              stops={ISO_STOPS}
              index={rig.isoIndex}
              min={isoMin}
              format={(s) => `ISO ${s.label}`}
              onChange={(i) => api.getState().update({ isoIndex: i })}
            />
          )}
        </section>
      )}

      {optics && (
        <section>
          <h3>レンズとピント</h3>
          {has('lens') && (
            <label className="field">
              <span>レンズ</span>
              <select value={rig.lensId} onChange={(e) => api.getState().setLens(e.target.value)}>
                {LENSES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {has('focal') && lens.minFocal !== lens.maxFocal && (
            <label className="field">
              <span>
                焦点距離 <b>{Math.round(rig.focal)}mm</b>
              </span>
              <input
                type="range"
                min={lens.minFocal}
                max={lens.maxFocal}
                step={1}
                value={rig.focal}
                onChange={(e) => {
                  const focal = Number(e.target.value);
                  api.getState().update({ focal, fIndex: Math.max(rig.fIndex, minFIndex(lens, focal)) });
                }}
              />
            </label>
          )}
          {has('focus') && (
            <div className="field">
              <span>
                ピント{' '}
                <b>{(tel?.focusM ?? rig.focusM).toFixed(2)}m</b>
              </span>
              <div className="segmented">
                <button className={rig.focusMode === 'af' ? 'on' : ''} onClick={() => api.getState().update({ focusMode: 'af' })}>
                  AF
                </button>
                <button
                  className={rig.focusMode === 'mf' ? 'on' : ''}
                  onClick={() => api.getState().update({ focusMode: 'mf', focusM: tel?.focusM ?? rig.focusM })}
                >
                  MF
                </button>
              </div>
              {rig.focusMode === 'mf' && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={toSlider(rig.focusM, lens.minFocusM)}
                  onChange={(e) => api.getState().update({ focusM: fromSlider(Number(e.target.value), lens.minFocusM) })}
                />
              )}
            </div>
          )}
        </section>
      )}

      {support && (
        <section>
          <h3>手ブレ対策</h3>
          {has('stabilization') && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={rig.stabilization}
                onChange={(e) => api.getState().update({ stabilization: e.target.checked })}
              />
              手ぶれ補正（5段分）
            </label>
          )}
          {has('tripod') && (
            <label className="toggle">
              <input type="checkbox" checked={rig.tripod} onChange={(e) => api.getState().update({ tripod: e.target.checked })} />
              三脚を使う
            </label>
          )}
        </section>
      )}

      {sceneCtl && (
        <section>
          <h3>シーン</h3>
          {has('scene') && (
            <label className="field">
              <span>場所</span>
              <select value={rig.sceneId} onChange={(e) => api.getState().setScene(e.target.value)}>
                {SCENES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {has('lighting') && (
            <label className="field">
              <span>明るさ</span>
              <select value={rig.lighting} onChange={(e) => api.getState().update({ lighting: e.target.value })}>
                {scene.lighting.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {has('params') &&
            scene.params.map((p) => (
              <label className="field" key={p.id}>
                <span>
                  {p.label}{' '}
                  <b>
                    {rig.params[p.id]}
                    {p.unit}
                  </b>
                </span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={rig.params[p.id] ?? p.default}
                  onChange={(e) => api.getState().setParam(p.id, Number(e.target.value))}
                />
              </label>
            ))}
        </section>
      )}
    </div>
  );
}
