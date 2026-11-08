import { createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { getLens, minFIndex } from '../camera/lenses';
import {
  F_STOPS,
  ISO_NATIVE_MAX,
  ISO_STOPS,
  SS_STOPS,
  cropFactor,
  getProfile,
  nearestStopIndex,
  solveExposure,
  type Stop,
} from '../physics';
import type { Engine, Telemetry } from '../render/Engine';
import { analyze, effectiveSensor, rigValues, type Analysis } from '../store/analysis';
import type { Rig, RigStore } from '../store/rig';

interface RigContextValue {
  rig: RigStore;
  telemetry: Telemetry | null;
  setTelemetry(t: Telemetry): void;
  engineRef: MutableRefObject<Engine | null>;
}

const RigContext = createContext<RigContextValue | null>(null);

/** 現在の目盛りから 0.22 段以上ずれたときだけ動かす（値がちらつかないように） */
const HYSTERESIS_STOPS = 0.22;

function nextIndex(stops: Stop[], current: number, target: number, min: number): number {
  if (Math.abs(Math.log2(stops[current].value / target)) < HYSTERESIS_STOPS) return current;
  return Math.max(min, nearestStopIndex(stops, target));
}

/** A / S / P / オートISO で、測光値に合わせて自動で決まる値を更新する */
function useAutoExposure(rig: RigStore, telemetry: Telemetry | null) {
  useEffect(() => {
    if (!telemetry) return;
    const r = rig.getState();
    if (r.mode === 'M' && !r.autoIso) return;
    const { n, t, iso } = rigValues(r);
    const lens = getLens(r.lensId);
    const minFi = minFIndex(lens, r.focal);
    const minIso = getProfile(r.profile).minIso;
    const equivalent = r.focal * cropFactor(effectiveSensor(r));
    const result = solveExposure({
      mode: r.mode,
      autoIso: r.autoIso,
      luminance: Math.max(telemetry.meteredLuminance, 1e-3),
      comp: r.comp,
      n,
      t,
      iso,
      minN: F_STOPS[minFi].value,
      maxN: F_STOPS[F_STOPS.length - 1].value,
      slowestT: Math.min(1 / 30, 1 / equivalent),
      minIso,
      maxIso: ISO_NATIVE_MAX,
    });
    const fIndex = nextIndex(F_STOPS, r.fIndex, result.n, minFi);
    const ssIndex = nextIndex(SS_STOPS, r.ssIndex, result.t, 0);
    const isoIndex = nextIndex(ISO_STOPS, r.isoIndex, result.iso, nearestStopIndex(ISO_STOPS, minIso));
    if (fIndex !== r.fIndex || ssIndex !== r.ssIndex || isoIndex !== r.isoIndex) {
      r.update({ fIndex, ssIndex, isoIndex });
    }
  }, [rig, telemetry]);
}

export function RigProvider({ rig, children }: { rig: RigStore; children: ReactNode }) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const engineRef = useRef<Engine | null>(null);
  useAutoExposure(rig, telemetry);
  // 開発時にブラウザのコンソールから状態を確かめられるようにする
  if (import.meta.env.DEV) Object.assign(window, { __activeRig: rig, __tel: telemetry });
  const value = useMemo(() => ({ rig, telemetry, setTelemetry, engineRef }), [rig, telemetry]);
  return <RigContext.Provider value={value}>{children}</RigContext.Provider>;
}

function useCtx(): RigContextValue {
  const ctx = useContext(RigContext);
  if (!ctx) throw new Error('RigProvider が必要です');
  return ctx;
}

export function useRig<T>(selector: (r: Rig) => T): T {
  return useCtx().rig(selector);
}

export function useRigApi(): RigStore {
  return useCtx().rig;
}

export function useTelemetry(): Telemetry | null {
  return useCtx().telemetry;
}

export function useEngineRef(): MutableRefObject<Engine | null> {
  return useCtx().engineRef;
}

export function useSetTelemetry(): (t: Telemetry) => void {
  return useCtx().setTelemetry;
}

export function useAnalysis(): Analysis {
  const rig = useRig((r) => r);
  const telemetry = useTelemetry();
  return useMemo(() => analyze(rig, telemetry), [rig, telemetry]);
}
