import type { ReminderConfig } from './timer';

export type TimerLocale = 'en' | 'de';
export type AlertPreferences = { sound: boolean; vibration: boolean; notifications: boolean };

const minute = 60 * 1000;
const second = 1000;

export function timerPresets(locale: TimerLocale): readonly ReminderConfig[] {
  const text = timerCopy[locale];
  return [
    {
      id: 'eye-break',
      label: '20 · 20 · 20',
      workMs: 20 * minute,
      breakMs: 20 * second,
      instruction: text.lookFar,
    },
    {
      id: 'frequent',
      label: text.frequentBreaks,
      workMs: 10 * minute,
      breakMs: 30 * second,
      instruction: text.lookFar,
    },
    {
      id: 'stretch',
      label: text.stretchBreak,
      workMs: 45 * minute,
      breakMs: 2 * minute,
      instruction: text.standAndMove,
    },
  ];
}

export const timerCopy = {
  en: {
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
  },
  de: {
    subtitle: 'Sanfte Erinnerungen · nur auf deinem Gerät',
    setupEyebrow: 'Eine kleine, hilfreiche Unterbrechung',
    setupTitle: 'Schaffe Abstand zwischen den Bildschirmen.',
    setupDescription:
      'Wähle einen Rhythmus, lass die App geöffnet und werde erinnert, wegzuschauen oder dich zu bewegen.',
    chooseRhythm: 'Rhythmus wählen',
    every: 'Alle',
    breakFor: 'Pause für',
    minutes: 'Minuten',
    seconds: 'Sekunden',
    custom: 'Eigener Timer',
    customName: 'Name der Erinnerung',
    customInstruction: 'Anweisung für die Pause',
    alerts: 'Hinweise',
    sound: 'Sanfter Ton',
    soundHint: 'Nur zwei kurze Tiks-Signale',
    vibration: 'Vibration',
    vibrationHint: 'Wenn dieses Gerät es unterstützt',
    notifications: 'Systemmitteilung',
    notificationsHint: 'Bestmöglich, solange die App aktiv bleibt',
    notificationsDenied: 'Mitteilungen sind in den Browsereinstellungen blockiert.',
    notificationsUnavailable: 'Systemmitteilungen sind in diesem Browser nicht verfügbar.',
    notificationInstallHint:
      'Auf dem iPhone muss die PWA zuerst zum Home-Bildschirm hinzugefügt werden.',
    start: 'Pausentimer starten',
    noMedicalClaim:
      'Regelmäßige Pausen können den Sehkomfort unterstützen. Dieser Timer behandelt oder korrigiert keine Kurzsichtigkeit.',
    nextBreak: 'Nächste Pause',
    focusTime: 'Fokuszeit',
    atBreak: 'Bei der nächsten Pause',
    paused: 'Pausiert',
    resume: 'Fortsetzen',
    pause: 'Pausieren',
    takeBreak: 'Jetzt Pause machen',
    endSession: 'Sitzung beenden',
    dueAt: 'Fällig um',
    leaveOpen:
      'Lass diesen Tab oder die PWA geöffnet. Alarme bei geschlossener Web-App sind nicht zuverlässig.',
    breakEyebrow: 'Zeit zum Abschalten',
    lookAway: 'Schau von diesem Bildschirm weg.',
    breakHint:
      'Suche den entferntesten angenehmen Punkt. Blinzle natürlich und entspanne deine Schultern.',
    resetHint: 'Wenn möglich, verbringe die gesamte Pause abseits des Bildschirms.',
    skip: 'Pause überspringen',
    backSoon: 'Die Fokuszeit startet automatisch',
    complete: 'Sitzung beendet',
    completeHint: 'Ein wenig Abstand zwischen langen Phasen der Naharbeit.',
    elapsed: 'Dauer',
    reminders: 'Erinnerungen',
    finished: 'Pausen',
    skipped: 'Übersprungen',
    again: 'Neue Sitzung starten',
    lookFar: 'Schau auf etwas in ungefähr 6 Metern Entfernung und entspanne deine Augen.',
    standAndMove: 'Steh auf, strecke dich vorsichtig und bewege dich vom Bildschirm weg.',
    frequentBreaks: 'Häufige Augenpausen',
    stretchBreak: 'Bewegungspause',
    notificationTitle: 'Zeit wegzuschauen',
    notificationBody: 'Schau in die Ferne und entspanne deine Augen.',
  },
} as const;

export type TimerCopy = (typeof timerCopy)[TimerLocale];
