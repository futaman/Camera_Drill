import { LENSES, getLens, minFIndex } from '../camera/lenses';
import {
  BODIES,
  F_STOPS,
  ISO_NATIVE_MAX,
  ISO_STOPS,
  PROFILES,
  SS_STOPS,
  cropFactor,
  formatStops,
  getBody,
  getProfile,
  nearestStopIndex,
  type LensFx,
  type ProfileId,
  type ShootingMode,
} from '../physics';
import type { Metering } from '../render/Engine';
import { SCENES, getScene } from '../scenes';
import { StopControl } from './controls/StopControl';
import { useRig, useRigApi, useTelemetry } from './RigContext';

export type ControlId =
  | 'mode'
  | 'f'
  | 'ss'
  | 'iso'
  | 'comp'
  | 'metering'
  | 'profile'
  | 'body'
  | 'crop'
  | 'lens'
  | 'focal'
  | 'framingLock'
  | 'focus'
  | 'stabilization'
  | 'tripod'
  | 'fx'
  | 'scene'
  | 'lighting'
  | 'presets'
  | 'params';

export const ALL_CONTROLS: ControlId[] = [
  'mode', 'f', 'ss', 'iso', 'comp', 'metering', 'profile', 'body', 'crop', 'lens', 'focal', 'framingLock', 'focus',
  'stabilization', 'tripod', 'fx', 'scene', 'lighting', 'presets', 'params',
];

const MODES: { id: ShootingMode; hint: string }[] = [
  { id: 'M', hint: 'マニュアル: 全部自分で決める' },
  { id: 'A', hint: '絞り優先: F値を決めると、シャッタースピードはカメラが決める' },
  { id: 'S', hint: 'シャッター優先: シャッタースピードを決めると、F値はカメラが決める' },
  { id: 'P', hint: 'プログラム: F値もシャッタースピードもカメラが決める' },
];

const METERING: { id: Metering; label: string }[] = [
  { id: 'evaluative', label: '評価' },
  { id: 'center', label: '中央重点' },
  { id: 'spot', label: 'スポット' },
];

const FX_SLIDERS: { id: keyof LensFx; label: string; min: number; max: number; step: number }[] = [
  { id: 'chromatic', label: '倍率色収差', min: 0, max: 1, step: 0.05 },
  { id: 'spherical', label: '球面収差（開放のにじみ）', min: 0, max: 1, step: 0.05 },
  { id: 'distortion', label: '歪曲（左: 樽型 / 右: 糸巻き型）', min: -1, max: 1, step: 0.05 },
  { id: 'vignette', label: '周辺減光', min: 0, max: 1, step: 0.05 },
  { id: 'diffraction', label: '回折（0で無効、数値は見やすくする倍率）', min: 0, max: 20, step: 1 },
];

/** MFの距離スライダーは対数目盛り（0〜1 ↔ 最短撮影距離〜100m） */
const MF_FAR = 100;
const toSlider = (m: number, min: number) => Math.log(m / min) / Math.log(MF_FAR / min);
const fromSlider = (v: number, min: number) => min * (MF_FAR / min) ** v;

export function ControlPanel({ controls = ALL_CONTROLS, paramIds }: { controls?: ControlId[]; paramIds?: string[] }) {
  const rig = useRig((r) => r);
  const api = useRigApi();
  const tel = useTelemetry();
  const has = (id: ControlId) => controls.includes(id);
  const lens = getLens(rig.lensId);
  const scene = getScene(rig.sceneId);
  const body = getBody(rig.bodyId);
  const isoMin = nearestStopIndex(ISO_STOPS, getProfile(rig.profile).minIso);
  const isoMax = nearestStopIndex(ISO_STOPS, ISO_NATIVE_MAX);

  // 講座では paramIds で触れる項目を絞れる
  const visibleParams = paramIds ? scene.params.filter((p) => paramIds.includes(p.id)) : scene.params;

  const fAuto = rig.mode === 'S' || rig.mode === 'P';
  const ssAuto = rig.mode === 'A' || rig.mode === 'P';

  const exposure = has('mode') || has('f') || has('ss') || has('iso') || has('comp') || has('metering') || has('profile');
  const optics = has('body') || has('crop') || has('lens') || has('focal') || has('framingLock') || has('focus');
  const support = has('stabilization') || has('tripod');
  const sceneCtl = has('scene') || has('lighting') || has('presets') || (has('params') && scene.params.length > 0);

  return (
    <div className="control-panel">
      {exposure && (
        <section>
          <h3>露出</h3>
          {has('mode') && (
            <div className="field">
              <div className="segmented">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={rig.mode === m.id ? 'on' : ''}
                    title={m.hint}
                    onClick={() => api.getState().update({ mode: m.id })}
                  >
                    {m.id}
                  </button>
                ))}
              </div>
              <small className="muted field-note">{MODES.find((m) => m.id === rig.mode)?.hint}</small>
            </div>
          )}
          {has('f') && (
            <StopControl
              label="F値"
              sub={fAuto ? 'カメラが決定' : '絞り'}
              stops={F_STOPS}
              index={rig.fIndex}
              min={minFIndex(lens, rig.focal)}
              disabled={fAuto}
              format={(s) => `F${s.label}`}
              onChange={(i) => api.getState().update({ fIndex: i })}
            />
          )}
          {has('ss') && (
            <StopControl
              label="シャッタースピード"
              sub={ssAuto ? 'カメラが決定' : undefined}
              stops={SS_STOPS}
              index={rig.ssIndex}
              disabled={ssAuto}
              onChange={(i) => api.getState().update({ ssIndex: i })}
            />
          )}
          {has('iso') && (
            <StopControl
              label="ISO感度"
              sub={rig.autoIso ? 'カメラが決定' : undefined}
              stops={ISO_STOPS}
              index={rig.isoIndex}
              min={isoMin}
              max={isoMax}
              disabled={rig.autoIso}
              format={(s) => `ISO ${s.label}`}
              onChange={(i) => api.getState().update({ isoIndex: i })}
            />
          )}
          {has('iso') && has('mode') && (
            <label className="toggle">
              <input type="checkbox" checked={rig.autoIso} onChange={(e) => api.getState().update({ autoIso: e.target.checked })} />
              オートISO
            </label>
          )}
          {has('comp') && (
            <label className="field">
              <span>
                露出補正 <b>{formatStops(rig.comp)}段</b>
                {rig.mode === 'M' && !rig.autoIso && <small className="muted"> Mモードでは効きません</small>}
              </span>
              <input
                type="range"
                min={-3}
                max={3}
                step={1 / 3}
                value={rig.comp}
                onChange={(e) => api.getState().update({ comp: Number(e.target.value) })}
              />
            </label>
          )}
          {has('metering') && (
            <div className="field">
              <span>測光モード</span>
              <div className="segmented">
                {METERING.map((m) => (
                  <button key={m.id} className={rig.metering === m.id ? 'on' : ''} onClick={() => api.getState().update({ metering: m.id })}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {has('profile') && (
            <label className="field">
              <span>階調（ピクチャープロファイル）</span>
              <select value={rig.profile} onChange={(e) => api.getState().setProfile(e.target.value as ProfileId)}>
                {PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {optics && (
        <section>
          <h3>カメラとレンズ</h3>
          {has('body') && (
            <label className="field">
              <span>
                カメラ <b>換算 {cropFactor(body).toFixed(2)}倍</b>
              </span>
              <select value={rig.bodyId} onChange={(e) => api.getState().setBody(e.target.value)}>
                {BODIES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {has('crop') && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={rig.digitalCrop > 1}
                onChange={(e) => api.getState().update({ digitalCrop: e.target.checked ? 1.5 : 1 })}
              />
              中央を 1.5倍にトリミング（{(body.megapixels / (rig.digitalCrop > 1 ? 2.25 : 1)).toFixed(1)}MP）
            </label>
          )}
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
                onChange={(e) => api.getState().setFocal(Number(e.target.value))}
              />
            </label>
          )}
          {has('framingLock') && scene.params.some((p) => p.id === 'distance') && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={rig.framingLock !== null}
                onChange={(e) => api.getState().setFramingLock(e.target.checked)}
              />
              被写体の大きさを保つ（ズームに合わせて前後に動く）
            </label>
          )}
          {has('focus') && (
            <div className="field">
              <span>
                ピント <b>{(tel?.focusM ?? rig.focusM).toFixed(2)}m</b>
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

      {has('fx') && (
        <section>
          <h3>レンズの収差</h3>
          {FX_SLIDERS.map((s) => (
            <label className="field" key={s.id}>
              <span>
                {s.label} <b>{rig.lensFx[s.id]}</b>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={rig.lensFx[s.id]}
                onChange={(e) => api.getState().update({ lensFx: { ...rig.lensFx, [s.id]: Number(e.target.value) } })}
              />
            </label>
          ))}
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
          {has('lighting') && scene.lighting.length > 1 && (
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
          {has('presets') && scene.presets && (
            <div className="field">
              <span>定番のライティング</span>
              <div className="preset-list">
                {scene.presets.map((p) => (
                  <button key={p.id} onClick={() => api.getState().applyParams(p.params)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {has('params') &&
            visibleParams.map((p) =>
              p.options ? (
                <label className="field" key={p.id}>
                  <span>{p.label}</span>
                  <select value={rig.params[p.id] ?? p.default} onChange={(e) => api.getState().setParam(p.id, Number(e.target.value))}>
                    {p.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
              <label className="field" key={p.id}>
                <span>
                  {p.label}{' '}
                  <b>
                    {Number((rig.params[p.id] ?? p.default).toFixed(2))}
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
              ),
            )}
        </section>
      )}
    </div>
  );
}
