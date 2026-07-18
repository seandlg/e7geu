import { compactSpectrum, rmsToDecibelsFullScale } from '$lib/domain/sound';

export type SoundMeterReading = {
  decibelsFullScale: number;
  spectrum: number[];
};

export type SoundMeterSession = {
  stop: () => void;
};

type SafariWindow = Window & { webkitAudioContext?: typeof AudioContext };

export async function startSoundMeter(
  onReading: (reading: SoundMeterReading) => void,
): Promise<SoundMeterSession> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone API unavailable');

  const AudioContextClass = window.AudioContext ?? (window as SafariWindow).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio API unavailable');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    },
  });
  const context = new AudioContextClass();
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);

  const waveform = new Float32Array(analyser.fftSize);
  const frequencies = new Uint8Array(analyser.frequencyBinCount);
  let animationFrame: number | null = null;
  let lastReadingAt = 0;
  let stopped = false;

  const read = (timestamp: number): void => {
    if (stopped) return;
    if (timestamp - lastReadingAt >= 80) {
      lastReadingAt = timestamp;
      analyser.getFloatTimeDomainData(waveform);
      analyser.getByteFrequencyData(frequencies);
      onReading({
        decibelsFullScale: rmsToDecibelsFullScale(waveform),
        spectrum: compactSpectrum(frequencies),
      });
    }
    animationFrame = requestAnimationFrame(read);
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
  };

  if (context.state === 'suspended') await context.resume();
  animationFrame = requestAnimationFrame(read);
  return { stop };
}
