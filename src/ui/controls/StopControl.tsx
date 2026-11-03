import { useRef, type PointerEvent, type WheelEvent } from 'react';
import type { Stop } from '../../physics';
import { useSettings } from '../../store/settings';

interface Props {
  label: string;
  sub?: string;
  stops: Stop[];
  index: number;
  min?: number;
  max?: number;
  format?: (s: Stop) => string;
  onChange(index: number): void;
  disabled?: boolean;
}

const STEP_PX = 30;

/** 1/3段刻みの値を選ぶ操作部品。設定に応じてダイヤル風かスライダーで表示する */
export function StopControl(props: Props) {
  const style = useSettings((s) => s.controlStyle);
  const { label, sub, stops, index, format = (s) => s.label, disabled } = props;
  const min = props.min ?? 0;
  const max = props.max ?? stops.length - 1;
  const clamp = (i: number) => Math.min(max, Math.max(min, i));
  const change = (i: number) => {
    const c = clamp(i);
    if (c !== index) props.onChange(c);
  };

  return (
    <div className={`stop-control ${disabled ? 'is-disabled' : ''}`}>
      <div className="stop-head">
        <span className="stop-label">
          {label}
          {sub && <small>{sub}</small>}
        </span>
        <span className="stop-value">{format(stops[index])}</span>
      </div>
      {style === 'dial' ? (
        <Dial stops={stops} index={index} min={min} max={max} format={format} onChange={change} disabled={disabled} />
      ) : (
        <input
          type="range"
          className="stop-slider"
          min={min}
          max={max}
          step={1}
          value={index}
          disabled={disabled}
          onChange={(e) => change(Number(e.target.value))}
        />
      )}
    </div>
  );
}

function Dial({
  stops,
  index,
  min,
  max,
  format,
  onChange,
  disabled,
}: {
  stops: Stop[];
  index: number;
  min: number;
  max: number;
  format: (s: Stop) => string;
  onChange(i: number): void;
  disabled?: boolean;
}) {
  const drag = useRef<{ x: number; index: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, index };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = Math.round((drag.current.x - e.clientX) / STEP_PX);
    onChange(drag.current.index + delta);
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (disabled) return;
    onChange(index + (e.deltaY > 0 ? 1 : -1));
  };

  return (
    <div className="dial-row">
      <button className="dial-btn" disabled={disabled || index <= min} onClick={() => onChange(index - 1)} aria-label="前の値">
        ‹
      </button>
      <div
        className="dial"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        title="ドラッグまたはホイールで回す"
      >
        <div className="dial-tape" style={{ transform: `translateX(${-index * STEP_PX}px)` }}>
          {stops.map((s, i) => {
            const full = i % 3 === 0;
            const out = i < min || i > max;
            return (
              <div
                key={i}
                className={`dial-tick ${full ? 'full' : ''} ${i === index ? 'current' : ''} ${out ? 'out' : ''}`}
                style={{ left: i * STEP_PX }}
              >
                <span className="dial-mark" />
                {full && <span className="dial-text">{format(s)}</span>}
              </div>
            );
          })}
        </div>
        <div className="dial-center" />
      </div>
      <button className="dial-btn" disabled={disabled || index >= max} onClick={() => onChange(index + 1)} aria-label="次の値">
        ›
      </button>
    </div>
  );
}
