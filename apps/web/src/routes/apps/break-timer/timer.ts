export type ReminderConfig = {
  id: string;
  label: string;
  workMs: number;
  breakMs: number;
  instruction: string;
};

type SessionStats = {
  config: ReminderConfig;
  startedAt: number;
  reminders: number;
  breaksFinished: number;
  breaksSkipped: number;
};

export type RunningSession = SessionStats & {
  phase: 'work' | 'break';
  deadline: number;
};

export type PausedSession = SessionStats & {
  phase: 'paused';
  resumePhase: RunningSession['phase'];
  remainingMs: number;
};

export type TimerSession = RunningSession | PausedSession;

export type TimerEvent =
  | { type: 'tick'; now: number }
  | { type: 'take-break'; now: number }
  | { type: 'skip-break'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number };

export type SessionSummary = {
  elapsedMs: number;
  reminders: number;
  breaksFinished: number;
  breaksSkipped: number;
};

export function createSession(config: ReminderConfig, now: number): RunningSession {
  if (config.workMs <= 0 || config.breakMs <= 0) {
    throw new Error('Timer durations must be positive');
  }
  return {
    phase: 'work',
    config,
    startedAt: now,
    deadline: now + config.workMs,
    reminders: 0,
    breaksFinished: 0,
    breaksSkipped: 0,
  };
}

export function transitionTimer(session: TimerSession, event: TimerEvent): TimerSession {
  if (session.phase === 'paused') {
    if (event.type !== 'resume') return session;
    return {
      ...stats(session),
      phase: session.resumePhase,
      deadline: event.now + session.remainingMs,
    };
  }

  const current = reconcile(session, event.now);
  if (event.type === 'tick') return current;

  switch (event.type) {
    case 'take-break':
      return current.phase === 'work' ? beginBreak(current, event.now) : current;
    case 'skip-break':
      return current.phase === 'break'
        ? {
            ...stats(current),
            phase: 'work',
            deadline: event.now + current.config.workMs,
            breaksSkipped: current.breaksSkipped + 1,
          }
        : current;
    case 'pause':
      return {
        ...stats(current),
        phase: 'paused',
        resumePhase: current.phase,
        remainingMs: Math.max(0, current.deadline - event.now),
      };
    case 'resume':
      return current;
  }
}

export function remainingMs(session: TimerSession, now: number): number {
  return session.phase === 'paused' ? session.remainingMs : Math.max(0, session.deadline - now);
}

export function summarizeSession(session: TimerSession, now: number): SessionSummary {
  return {
    elapsedMs: Math.max(0, now - session.startedAt),
    reminders: session.reminders,
    breaksFinished: session.breaksFinished,
    breaksSkipped: session.breaksSkipped,
  };
}

export function restoreSession(value: unknown): TimerSession | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<TimerSession>;
  if (
    !candidate.config ||
    !isConfig(candidate.config) ||
    typeof candidate.startedAt !== 'number' ||
    typeof candidate.reminders !== 'number' ||
    typeof candidate.breaksFinished !== 'number' ||
    typeof candidate.breaksSkipped !== 'number'
  ) {
    return null;
  }
  if (
    (candidate.phase === 'work' || candidate.phase === 'break') &&
    typeof candidate.deadline === 'number'
  ) {
    return candidate as RunningSession;
  }
  if (
    candidate.phase === 'paused' &&
    (candidate.resumePhase === 'work' || candidate.resumePhase === 'break') &&
    typeof candidate.remainingMs === 'number'
  ) {
    return candidate as PausedSession;
  }
  return null;
}

function reconcile(session: RunningSession, now: number): RunningSession {
  if (now < session.deadline) return session;
  if (session.phase === 'work') return beginBreak(session, now);
  return {
    ...stats(session),
    phase: 'work',
    deadline: now + session.config.workMs,
    breaksFinished: session.breaksFinished + 1,
  };
}

function beginBreak(session: RunningSession, now: number): RunningSession {
  return {
    ...stats(session),
    phase: 'break',
    deadline: now + session.config.breakMs,
    reminders: session.reminders + 1,
  };
}

function stats(session: TimerSession): SessionStats {
  return {
    config: session.config,
    startedAt: session.startedAt,
    reminders: session.reminders,
    breaksFinished: session.breaksFinished,
    breaksSkipped: session.breaksSkipped,
  };
}

function isConfig(value: unknown): value is ReminderConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<ReminderConfig>;
  return (
    typeof config.id === 'string' &&
    typeof config.label === 'string' &&
    typeof config.instruction === 'string' &&
    typeof config.workMs === 'number' &&
    config.workMs > 0 &&
    typeof config.breakMs === 'number' &&
    config.breakMs > 0
  );
}
