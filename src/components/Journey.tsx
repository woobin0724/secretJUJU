import { useEffect, useMemo, useRef, useState } from 'react';
import { CASTES, CASTE_SPIN_MS, ISLAND_AFTER, ISLAND_HOLD_MS, ISLAND_SECONDS, ISLAND_THANKS_AT, STAMP_HOLD_MS, type SceneKey } from '../config';
import { TEXT } from '../content';
import { prefersReducedMotion } from '../hooks';
import { deriveStep, EMPTY_PROGRESS, hasAnyAnswer, pickIslandQuestion, stepKey, type Progress, type Step } from '../logic/flow';
import { QUESTION_IDS, type Answers, type FlowMode, type Phase, type QuestionId } from '../types';
import { Backdrop, preloadScene } from './Backdrop';
import { SoundToggle } from './SoundToggle';

const PROGRESS_KEY = 'bnw:progress';

function loadProgress(mode: FlowMode): Progress {
  if (mode === 'solo') return EMPTY_PROGRESS;
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as Partial<Progress> | null;
    if (!p) return EMPTY_PROGRESS;
    return {
      started: false,
      islandsDone: Array.isArray(p.islandsDone) ? p.islandsDone.filter((q): q is QuestionId => QUESTION_IDS.includes(q)) : [],
      casteDone: p.casteDone === true,
      stampDone: p.stampDone === true,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function sceneOf(step: Step): SceneKey {
  switch (step.kind) {
    case 'waiting':
    case 'lobby':
      return 'city';
    case 'arrival':
      return 'arrival';
    case 'question':
      return step.q === 'q4' ? 'hatchery' : 'sorting';
    case 'island':
      return 'island';
    case 'caste':
    case 'stamp':
    case 'recheck':
      return 'hatchery';
    case 'exit':
      return 'exit';
  }
}

const NEXT_SCENES: Record<SceneKey, SceneKey[]> = {
  city: ['arrival', 'hatchery'],
  arrival: ['sorting'],
  sorting: ['hatchery', 'island'],
  hatchery: ['island', 'exit', 'city'],
  island: ['hatchery', 'sorting'],
  exit: [],
};

interface Props {
  mode: FlowMode;
  phase: Phase;
  mine: { round1: Answers; round2: Answers };
  onAnswer: (round: 1 | 2, q: QuestionId, value: boolean) => void;
  /** 혼자 해보기에서만: 재심사로 넘어간다 */
  onRecheck?: () => void;
}

export function Journey({ mode, phase, mine, onAnswer, onRecheck }: Props) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(mode));

  // 대기 단계로 돌아오면(초기화 등) 기기 진행 상태도 처음으로 돌린다.
  useEffect(() => {
    if (phase === 'waiting') setProgress(EMPTY_PROGRESS);
  }, [phase]);

  // 응답이 하나도 없으면(전체 초기화 뒤) 예전 진행 기록은 무시한다.
  const effective = useMemo<Progress>(
    () => (hasAnyAnswer(mine.round1) ? progress : { ...EMPTY_PROGRESS, started: progress.started }),
    [mine.round1, progress],
  );

  useEffect(() => {
    if (mode !== 'live') return;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(effective));
    } catch {
      /* 저장하지 못해도 진행에는 문제가 없다 */
    }
  }, [mode, effective]);

  const step = deriveStep(phase, mine, effective, ISLAND_AFTER[mode]);
  const key = stepKey(step);
  const scene = sceneOf(step);

  useEffect(() => {
    const t = setTimeout(() => NEXT_SCENES[scene].forEach(preloadScene), 800);
    return () => clearTimeout(t);
  }, [scene]);

  const mark = (p: Partial<Progress>) => setProgress({ ...effective, ...p });

  return (
    <div className="stage" data-step={key}>
      <Backdrop key={scene} scene={scene} loop={scene !== 'exit'} />
      <main key={key} className="panel fade">
        {step.kind === 'waiting' && <Waiting />}
        {step.kind === 'arrival' && <Arrival onStart={() => mark({ started: true })} />}
        {step.kind === 'question' && (
          <Question
            label={TEXT.progress(step.index + 1, QUESTION_IDS.length)}
            index={step.index}
            text={TEXT.questions[step.q]}
            choices={TEXT.choices[step.q]}
            onPick={(v) => onAnswer(1, step.q, v)}
          />
        )}
        {step.kind === 'island' && (
          <Island
            question={pickIslandQuestion(TEXT.island.questions, step.q, step.answer)}
            onDone={() => mark({ islandsDone: [...effective.islandsDone.filter((q) => q !== step.q), step.q] })}
          />
        )}
        {step.kind === 'caste' && <Caste onDone={() => mark({ casteDone: true })} />}
        {step.kind === 'stamp' && <Stamp onDone={() => mark({ stampDone: true })} />}
        {step.kind === 'lobby' && <Lobby closed={step.closed} onRecheck={onRecheck} />}
        {step.kind === 'recheck' && (
          <Question label={TEXT.recheck.label} text={TEXT.recheck.question} choices={TEXT.choices.q4} onPick={(v) => onAnswer(2, 'q4', v)} />
        )}
        {step.kind === 'exit' && <Exit first={mine.round1.q4} now={mine.round2.q4} />}
      </main>
      <SoundToggle scene={scene} />
    </div>
  );
}

function Waiting() {
  return (
    <div className="mid center">
      <h1 className="serif title">{TEXT.waiting.title}</h1>
      <p className="motto">{TEXT.waiting.motto}</p>
      <p className="note">{TEXT.waiting.note}</p>
    </div>
  );
}

function Arrival({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="mid center">
        <p className="serif lead">{TEXT.arrival.body}</p>
      </div>
      <div className="bottom">
        <button className="btn primary" onClick={onStart}>
          {TEXT.arrival.start}
        </button>
      </div>
    </>
  );
}

function Question(props: { label: string; index?: number; text: string; choices: { yes: string; no: string }; onPick: (v: boolean) => void }) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const pick = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    props.onPick(v);
  };
  return (
    <>
      <div className="top">
        <span className="label">{props.label}</span>
        {props.index !== undefined && (
          <span className="dots" aria-hidden="true">
            {QUESTION_IDS.map((q, i) => (
              <i key={q} className={i <= props.index! ? 'on' : ''} />
            ))}
          </span>
        )}
      </div>
      <div className="mid center">
        <h1 className="serif question">{props.text}</h1>
      </div>
      <div className="bottom two">
        <button className={`btn${picked === true ? ' picked' : ''}`} disabled={picked !== null} onClick={() => pick(true)}>
          {props.choices.yes}
        </button>
        <button className={`btn${picked === false ? ' picked' : ''}`} disabled={picked !== null} onClick={() => pick(false)}>
          {props.choices.no}
        </button>
      </div>
    </>
  );
}

/** 10초 동안 넘길 수 없는 화면. 버튼이 없고, 시간은 벽시계 기준으로 센다. */
function Island({ question, onDone }: { question: string; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const start = Date.now();
    let finished = false;
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if (!finished && ms >= ISLAND_SECONDS * 1000 + ISLAND_HOLD_MS) {
        finished = true;
        clearInterval(id);
        done.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil(ISLAND_SECONDS - elapsed / 1000));
  const thanks = remaining <= ISLAND_THANKS_AT;
  return (
    <>
      <div className="top">
        <p className="island-top">{TEXT.island.top}</p>
      </div>
      <div className="mid center">
        <p key={thanks ? 'thanks' : 'q'} className="serif question fade" data-testid="island-text">
          {thanks ? TEXT.island.thanks : question}
        </p>
      </div>
      <div className="bottom center">
        <span className="count" data-testid="island-count" aria-live="off">
          {remaining}
        </span>
      </div>
    </>
  );
}

function Caste({ onDone }: { onDone: () => void }) {
  const reduced = prefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<'spin' | 'fading' | 'result'>(reduced ? 'result' : 'spin');
  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // 처음에는 빠르게, 갈수록 느리게 돈다.
    let t = 0;
    let gap = 70;
    let i = 0;
    while (t < CASTE_SPIN_MS) {
      const at = t;
      const n = ++i;
      timers.push(setTimeout(() => setIndex(n % CASTES.length), at));
      t += gap;
      gap *= 1.16;
    }
    // 멈추기 직전에 사라진다.
    timers.push(setTimeout(() => setStage('fading'), CASTE_SPIN_MS - 500));
    timers.push(setTimeout(() => setStage('result'), CASTE_SPIN_MS + 300));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);
  const caste = CASTES[index];
  return (
    <>
      <div className="top">
        <span className="label">{TEXT.caste.title}</span>
      </div>
      <div className="mid center">
        {stage !== 'result' ? (
          <div className={`slot${stage === 'fading' ? ' out' : ''}`} data-testid="caste-slot">
            <span className={`chip caste-${caste.key}`} style={{ background: caste.color }}>
              {TEXT.caste.names[caste.key]}
            </span>
          </div>
        ) : (
          <div className="result" data-testid="caste-result">
            <p className="serif question stagger s1">{TEXT.caste.result1}</p>
            <p className="serif question accent stagger s2">{TEXT.caste.result2}</p>
            <p className="note stagger s3">{TEXT.caste.note}</p>
          </div>
        )}
      </div>
      <div className="bottom">
        {stage === 'result' && (
          <button className="btn primary stagger s4" onClick={onDone}>
            {TEXT.caste.next}
          </button>
        )}
      </div>
    </>
  );
}

function Stamp({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const buzz = setTimeout(() => {
      try {
        navigator.vibrate?.(50);
      } catch {
        /* 진동을 지원하지 않는 기기 */
      }
    }, 300);
    const t = setTimeout(() => done.current(), STAMP_HOLD_MS);
    return () => {
      clearTimeout(buzz);
      clearTimeout(t);
    };
  }, []);
  return (
    <div className="mid center">
      <div className="stamp" data-testid="stamp">
        {TEXT.stamp.label}
      </div>
    </div>
  );
}

function Lobby({ closed, onRecheck }: { closed: boolean; onRecheck?: () => void }) {
  return (
    <>
      <div className="mid center">
        <p className="motto">{TEXT.waiting.motto}</p>
        <p className="serif lead">{onRecheck ? TEXT.lobby.soloBody : closed ? TEXT.lobby.closed : TEXT.lobby.approved}</p>
      </div>
      {onRecheck && (
        <div className="bottom">
          <button className="btn primary" onClick={onRecheck}>
            {TEXT.lobby.soloNext}
          </button>
        </div>
      )}
    </>
  );
}

function Exit({ first, now }: { first?: boolean; now?: boolean }) {
  const name = (v: boolean) => (v ? TEXT.choices.q4.yes : TEXT.choices.q4.no);
  return (
    <>
      <div className="mid center">
        {typeof first === 'boolean' && typeof now === 'boolean' && (
          <p className="compare" data-testid="compare">
            {TEXT.exit.compare(name(first), name(now))}
          </p>
        )}
        <h1 className="serif title">{TEXT.exit.title}</h1>
      </div>
      <div className="bottom center">
        <p className="credit">{TEXT.exit.credit}</p>
      </div>
    </>
  );
}
