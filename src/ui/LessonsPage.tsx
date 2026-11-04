import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, LESSONS } from '../lessons/data';
import type { ChallengeStep, Lesson, SimStep, Step } from '../lessons/types';
import { formatStops } from '../physics';
import { createRigStore } from '../store/rig';
import { useProgress, useSettings } from '../store/settings';
import { ControlPanel } from './ControlPanel';
import { Figure } from './figures/Figures';
import { DofBar, Histogram, InfoBar, TopView } from './Readouts';
import { RichText } from './RichText';
import { RigProvider, useAnalysis } from './RigContext';
import { Viewfinder } from './Viewfinder';

export function LessonsPage() {
  const completed = useProgress((p) => p.completed);
  const current = useProgress((p) => p.currentLesson);
  const setCurrent = useProgress((p) => p.setCurrent);
  const lesson = LESSONS.find((l) => l.id === current) ?? LESSONS[0];

  return (
    <div className="lessons">
      <nav className="lesson-nav">
        {CHAPTERS.map((ch) => (
          <div key={ch.n} className="lesson-chapter">
            <h4>{ch.n < 90 ? `${ch.n}. ${ch.title}` : ch.title}</h4>
            {LESSONS.filter((l) => l.chapter === ch.n).map((l) => (
              <button key={l.id} className={`lesson-link ${l.id === lesson.id ? 'on' : ''}`} onClick={() => setCurrent(l.id)}>
                <span className={`check ${completed[l.id] ? 'done' : ''}`}>{completed[l.id] ? '✓' : ''}</span>
                <span className="lesson-id">{l.id}</span>
                {l.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <LessonView key={lesson.id} lesson={lesson} />
    </div>
  );
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [passed, setPassed] = useState<Record<number, boolean>>({});
  const complete = useProgress((p) => p.complete);
  const setCurrent = useProgress((p) => p.setCurrent);
  const showAdvanced = useSettings((s) => s.showAdvanced);
  const total = lesson.steps.length + 1; // 最後は「まとめ」
  const onSummary = stepIndex === lesson.steps.length;
  const step = lesson.steps[stepIndex];
  const next = LESSONS[LESSONS.indexOf(lesson) + 1];

  return (
    <article className="lesson">
      <header className="lesson-head">
        <span className="muted">
          {CHAPTERS.find((c) => c.n === lesson.chapter)?.title} / {lesson.id}
        </span>
        <h2>{lesson.title}</h2>
        <div className="step-dots">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              className={`step-dot ${i === stepIndex ? 'on' : ''} ${passed[i] ? 'passed' : ''}`}
              onClick={() => setStepIndex(i)}
              aria-label={`ステップ ${i + 1}`}
            >
              {i === total - 1 ? 'まとめ' : i + 1}
            </button>
          ))}
        </div>
      </header>

      {onSummary ? (
        <section className="lesson-summary">
          <h3>まとめ</h3>
          <ul>
            {lesson.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {lesson.advanced && (
            <details className="advanced" open={showAdvanced}>
              <summary>もっと詳しく（発展）</summary>
              <RichText text={lesson.advanced} />
            </details>
          )}
          <div className="lesson-actions">
            <button onClick={() => setStepIndex(stepIndex - 1)}>戻る</button>
            <button
              className="primary"
              onClick={() => {
                complete(lesson.id);
                if (next) setCurrent(next.id);
              }}
            >
              {next ? `完了して次へ（${next.id} ${next.title}）` : '完了'}
            </button>
          </div>
        </section>
      ) : (
        <StepView
          key={stepIndex}
          step={step}
          passed={!!passed[stepIndex]}
          onPass={() => setPassed((p) => ({ ...p, [stepIndex]: true }))}
          onPrev={stepIndex > 0 ? () => setStepIndex(stepIndex - 1) : undefined}
          onNext={() => setStepIndex(stepIndex + 1)}
        />
      )}
    </article>
  );
}

interface StepProps {
  step: Step;
  passed: boolean;
  onPass(): void;
  onPrev?: () => void;
  onNext(): void;
}

function StepView(props: StepProps) {
  const { step } = props;
  if (step.kind === 'text') {
    return (
      <section className="step-text">
        <h3>{step.title}</h3>
        {step.figure && !step.figureAfter && <Figure id={step.figure} />}
        <RichText text={step.body} />
        {step.figure && step.figureAfter && <Figure id={step.figure} />}
        <StepActions {...props} />
      </section>
    );
  }
  return <SimStepView {...props} step={step} />;
}

function StepActions({ onPrev, onNext }: StepProps) {
  return (
    <div className="lesson-actions">
      {onPrev && <button onClick={onPrev}>戻る</button>}
      <button className="primary" onClick={onNext}>
        次へ
      </button>
    </div>
  );
}

function SimStepView(props: StepProps & { step: SimStep | ChallengeStep }) {
  const { step } = props;
  const rig = useMemo(() => createRigStore(step.rig), [step]);
  return (
    <RigProvider rig={rig}>
      <section className="step-sim">
        <div className="step-sim-main">
          <Viewfinder />
          <InfoBar />
          {step.dofBar && <DofBar />}
          {step.topView && <TopView />}
        </div>
        <aside className="step-sim-side">
          <h3>{step.title}</h3>
          <RichText text={step.body} />
          {step.kind === 'challenge' && <Goal step={step} passed={props.passed} onPass={props.onPass} />}
          {step.histogram && <Histogram />}
          {step.controls.length > 0 && <ControlPanel controls={step.controls} paramIds={step.paramIds} />}
          <Metrics />
          <StepActions {...props} />
        </aside>
      </section>
    </RigProvider>
  );
}

/** 課題の判定。条件を 0.6 秒続けて満たしたら達成 */
function Goal({ step, passed, onPass }: { step: ChallengeStep; passed: boolean; onPass(): void }) {
  const a = useAnalysis();
  const ok = a.ready && step.goal(a);
  const okRef = useRef(ok);
  okRef.current = ok;
  const onPassRef = useRef(onPass);
  onPassRef.current = onPass;
  const [showHint, setShowHint] = useState(false);

  // 条件を満たしてから 0.6 秒後にもまだ満たしていれば達成
  useEffect(() => {
    if (!ok || passed) return;
    const id = setTimeout(() => {
      if (okRef.current) onPassRef.current();
    }, 600);
    return () => clearTimeout(id);
  }, [ok, passed]);

  return (
    <div className={`goal ${passed ? 'passed' : ok ? 'ok' : ''}`}>
      <div className="goal-label">
        <span className="goal-icon">{passed ? '✓' : '◎'}</span>
        <span>
          <small>課題</small>
          {step.goalLabel}
        </span>
      </div>
      {passed ? (
        <p className="goal-msg">達成！ 「次へ」で進みましょう。</p>
      ) : (
        <button className="link" onClick={() => setShowHint((v) => !v)}>
          {showHint ? step.hint : 'ヒントを見る'}
        </button>
      )}
    </div>
  );
}

/** いまの写真の状態を数値で示す */
function Metrics() {
  const a = useAnalysis();
  const fmt = (v: number | undefined) => (v === undefined ? '—' : `${Math.abs(v) < 0.95 ? '0' : Math.abs(v).toFixed(1)}px`);
  return (
    <dl className="metrics">
      <div>
        <dt>露出</dt>
        <dd>{a.ready ? `${formatStops(a.meterStops)}段` : '—'}</dd>
      </div>
      <div>
        <dt>被写体のボケ</dt>
        <dd>{fmt(a.coc.subject)}</dd>
      </div>
      <div>
        <dt>背景のボケ</dt>
        <dd>{fmt(a.coc.background)}</dd>
      </div>
      <div>
        <dt>手ブレ</dt>
        <dd>{fmt(a.shakePx)}</dd>
      </div>
      <div>
        <dt>被写体ブレ</dt>
        <dd>{fmt(a.motionPx)}</dd>
      </div>
    </dl>
  );
}
