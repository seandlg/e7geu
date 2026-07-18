import type { ReminderConfig } from './timer';

export type AlertPreferences = { sound: boolean; vibration: boolean; notifications: boolean };

const minute = 60 * 1000;
const second = 1000;

export function timerPresets(): readonly ReminderConfig[] {
  return [
    {
      id: 'eye-break',
      label: '20 · 20 · 20',
      workMs: 20 * minute,
      breakMs: 20 * second,
      instruction: timerCopy.lookFar,
    },
    {
      id: 'frequent',
      label: timerCopy.frequentBreaks,
      workMs: 10 * minute,
      breakMs: 30 * second,
      instruction: timerCopy.lookFar,
    },
    {
      id: 'stretch',
      label: timerCopy.stretchBreak,
      workMs: 45 * minute,
      breakMs: 2 * minute,
      instruction: timerCopy.standAndMove,
    },
  ];
}

export const timerCopy = {
  subtitle: 'Gentle reminders · entirely on your device',
  setupEyebrow: 'A small interruption that helps',
  setupTitle: 'Make space between the screens.',
  setupDescription:
    'Choose a rhythm, leave this app open, and let it remind you when it is time to look away or move.',
  chooseRhythm: 'Choose a rhythm',
  every: 'Every',
  breakFor: 'break for',
  minutes: 'minutes',
  seconds: 'seconds',
  custom: 'Custom',
  customName: 'Reminder name',
  customInstruction: 'Break instruction',
  alerts: 'Alerts',
  sound: 'Gentle sound',
  soundHint: 'Two short Tiks cues only',
  vibration: 'Vibration',
  vibrationHint: 'When supported by this device',
  notifications: 'System notification',
  notificationsHint: 'Best effort while the app remains active',
  notificationsDenied: 'Notifications are blocked in browser settings.',
  notificationsUnavailable: 'System notifications are unavailable in this browser.',
  notificationInstallHint: 'On iPhone, install this PWA on the Home Screen first.',
  start: 'Start break timer',
  noMedicalClaim:
    'Regular breaks may help with screen comfort. This timer does not treat or reverse myopia.',
  nextBreak: 'Next break',
  focusTime: 'Focus time',
  atBreak: 'At the next break',
  paused: 'Paused',
  resume: 'Resume',
  pause: 'Pause',
  takeBreak: 'Take a break now',
  endSession: 'End session',
  dueAt: 'Due at',
  leaveOpen:
    'Keep this tab or PWA open for reminders. Closed-app alarms are not reliable on the web.',
  breakEyebrow: 'Time to reset',
  lookAway: 'Look away from this screen.',
  breakHint: 'Find the farthest comfortable object. Blink naturally and relax your shoulders.',
  resetHint: 'If you can, take the full pause away from the screen.',
  skip: 'Skip this break',
  backSoon: 'Focus resumes automatically',
  complete: 'Session complete',
  completeHint: 'A little distance between long stretches of near work.',
  elapsed: 'Elapsed',
  reminders: 'Reminders',
  finished: 'Breaks run',
  skipped: 'Skipped',
  again: 'Start another session',
  lookFar: 'Look at something about 6 metres away and let your eyes relax.',
  standAndMove: 'Stand up, stretch gently, and move away from the screen.',
  frequentBreaks: 'Frequent eye breaks',
  stretchBreak: 'Stretch break',
  notificationTitle: 'Time to look away',
  notificationBody: 'Focus on something far away and let your eyes relax.',
} as const;

export type TimerCopy = typeof timerCopy;
