import { describe, expect, it } from 'vite-plus/test';
import { compactSpectrum, estimateSoundLevel, rmsToDecibelsFullScale, soundContext } from './sound';

describe('sound measurements', () => {
  it('converts waveform RMS to decibels full scale', () => {
    expect(rmsToDecibelsFullScale(new Float32Array([0.5, -0.5]))).toBeCloseTo(-6.02, 1);
    expect(rmsToDecibelsFullScale(new Float32Array(32))).toBe(-100);
  });

  it('maps microphone levels into a bounded estimated SPL range', () => {
    expect(estimateSoundLevel(-40)).toBe(60);
    expect(estimateSoundLevel(-200)).toBe(20);
    expect(estimateSoundLevel(40)).toBe(120);
  });

  it('communicates hearing-risk levels without overstating quiet readings', () => {
    expect(soundContext(60).label).toBe('Conversation');
    expect(soundContext(90).caution).toBe(true);
  });

  it('reduces FFT bins into normalized display bands', () => {
    const values = new Uint8Array(64);
    values[2] = 255;
    const bands = compactSpectrum(values, 8);
    expect(bands).toHaveLength(8);
    expect(Math.max(...bands)).toBe(1);
    expect(bands.every((value) => value >= 0 && value <= 1)).toBe(true);
  });
});
