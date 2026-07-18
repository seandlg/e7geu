import { init, mute, notify, setVolume, success, unmute } from '@rexa-developer/tiks';

let enabled = false;
let initialized = false;

export function configureTimerAudio(nextEnabled: boolean): void {
  enabled = nextEnabled;
  if (!initialized) {
    init({ theme: 'glass', volume: 0.22, muted: !enabled, respectReducedMotion: true });
    initialized = true;
    return;
  }
  setVolume(0.22);
  if (enabled) unmute();
  else mute();
}

export function playBreakDue(): void {
  if (enabled) notify();
}

export function playBreakFinished(): void {
  if (enabled) success();
}
