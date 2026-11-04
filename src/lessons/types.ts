import type { Analysis } from '../store/analysis';
import type { RigInit } from '../store/rig';
import type { ControlId } from '../ui/ControlPanel';

export type FigureId =
  | 'pipeline'
  | 'stops'
  | 'aperture'
  | 'equivalent'
  | 'coc'
  | 'focal'
  | 'sensors'
  | 'compression'
  | 'ev'
  | 'modes'
  | 'log'
  | 'chromatic'
  | 'spherical'
  | 'distortion'
  | 'diffraction'
  | 'cropDemo'
  | 'lightSize'
  | 'lightAngles'
  | 'inverseSquare';

interface StepBase {
  title: string;
  /** 本文。空行で段落、行頭の「- 」で箇条書き、**太字** が使える */
  body: string;
}

export interface TextStep extends StepBase {
  kind: 'text';
  figure?: FigureId;
  /** 図を本文の後に置く */
  figureAfter?: boolean;
}

export interface SimStep extends StepBase {
  kind: 'sim';
  rig: RigInit;
  controls: ControlId[];
  /** controls に params があるとき、触れる項目を絞る */
  paramIds?: string[];
  histogram?: boolean;
  dofBar?: boolean;
  topView?: boolean;
}

export interface ChallengeStep extends StepBase {
  kind: 'challenge';
  rig: RigInit;
  controls: ControlId[];
  /** controls に params があるとき、触れる項目を絞る */
  paramIds?: string[];
  histogram?: boolean;
  dofBar?: boolean;
  topView?: boolean;
  /** 達成条件の説明（画面に表示） */
  goalLabel: string;
  goal(a: Analysis): boolean;
  hint: string;
}

export type Step = TextStep | SimStep | ChallengeStep;

export interface Lesson {
  id: string;
  chapter: number;
  title: string;
  steps: Step[];
  summary: string[];
  /** 発展的な説明（設定で「発展も表示」にすると最初から開く） */
  advanced?: string;
}

export interface Chapter {
  n: number;
  title: string;
}
