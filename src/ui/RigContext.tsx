import { createContext, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { Engine, Telemetry } from '../render/Engine';
import { analyze, type Analysis } from '../store/analysis';
import type { Rig, RigStore } from '../store/rig';

interface RigContextValue {
  rig: RigStore;
  telemetry: Telemetry | null;
  setTelemetry(t: Telemetry): void;
  engineRef: MutableRefObject<Engine | null>;
}

const RigContext = createContext<RigContextValue | null>(null);

export function RigProvider({ rig, children }: { rig: RigStore; children: ReactNode }) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const engineRef = useRef<Engine | null>(null);
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
