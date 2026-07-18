import { describe, expect, it } from 'vite-plus/test';
import { timerPresets } from './content';
import {
  createSession,
  remainingMs,
  restoreSession,
  summarizeSession,
  transitionTimer,
  type ReminderConfig,
  type TimerSession,
} from './timer';

const config: ReminderConfig = {
  id: 'eye-break',
  label: '20 · 20 · 20',
  workMs: 20 * 60 * 1000,
  breakMs: 20 * 1000,
  instruction: 'Look far away',
};

describe('break timer', () => {
  it('ships the literal 20-20-20 preset', () => {
    expect(timerPresets('en')[0]).toMatchObject({
      id: 'eye-break',
      workMs: 20 * 60 * 1000,
      breakMs: 20 * 1000,
    });
  });

  it('starts with an absolute work deadline', () => {
    const session = createSession(config, 1000);
    expect(session).toMatchObject({ phase: 'work', deadline: 1_201_000, reminders: 0 });
    expect(remainingMs(session, 2000)).toBe(1_199_000);
  });

  it('starts a fresh break when the work deadline is observed', () => {
    const session = transitionTimer(createSession(config, 0), {
      type: 'tick',
      now: config.workMs + 5000,
    });
    expect(session).toMatchObject({
      phase: 'break',
      deadline: config.workMs + 5000 + config.breakMs,
      reminders: 1,
    });
  });

  it('automatically returns to work after a break', () => {
    let session: TimerSession = createSession(config, 0);
    session = transitionTimer(session, { type: 'take-break', now: 1000 });
    session = transitionTimer(session, { type: 'tick', now: 1000 + config.breakMs });
    expect(session).toMatchObject({
      phase: 'work',
      deadline: 1000 + config.breakMs + config.workMs,
      breaksFinished: 1,
    });
  });

  it('can take an early break without changing its configured duration', () => {
    const session = transitionTimer(createSession(config, 0), {
      type: 'take-break',
      now: 42_000,
    });
    expect(session).toMatchObject({
      phase: 'break',
      deadline: 42_000 + config.breakMs,
      reminders: 1,
    });
  });

  it('skips a break and begins a full work interval', () => {
    let session: TimerSession = createSession(config, 0);
    session = transitionTimer(session, { type: 'take-break', now: 1000 });
    session = transitionTimer(session, { type: 'skip-break', now: 2000 });
    expect(session).toMatchObject({
      phase: 'work',
      deadline: 2000 + config.workMs,
      breaksSkipped: 1,
    });
  });

  it('pauses and resumes the same phase with the remaining duration', () => {
    let session: TimerSession = createSession(config, 0);
    session = transitionTimer(session, { type: 'pause', now: 5000 });
    expect(session).toMatchObject({
      phase: 'paused',
      resumePhase: 'work',
      remainingMs: config.workMs - 5000,
    });
    session = transitionTimer(session, { type: 'resume', now: 100_000 });
    expect(session).toMatchObject({
      phase: 'work',
      deadline: 100_000 + config.workMs - 5000,
    });
  });

  it('summarizes session activity', () => {
    let session: TimerSession = createSession(config, 1000);
    session = transitionTimer(session, { type: 'take-break', now: 2000 });
    session = transitionTimer(session, { type: 'skip-break', now: 3000 });
    expect(summarizeSession(session, 61_000)).toEqual({
      elapsedMs: 60_000,
      reminders: 1,
      breaksFinished: 0,
      breaksSkipped: 1,
    });
  });

  it('restores valid local state and rejects malformed data', () => {
    const session = createSession(config, 1000);
    expect(restoreSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
    expect(restoreSession({ phase: 'work', deadline: 10 })).toBeNull();
    expect(restoreSession(null)).toBeNull();
  });
});
