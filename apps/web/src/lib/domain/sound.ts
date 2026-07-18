export type SoundContext = {
  label: string;
  detail: string;
  caution: boolean;
};

export function rmsToDecibelsFullScale(samples: Float32Array): number {
  if (samples.length === 0) return -100;
  let sumOfSquares = 0;
  for (const sample of samples) sumOfSquares += sample * sample;
  const rms = Math.sqrt(sumOfSquares / samples.length);
  return 20 * Math.log10(Math.max(rms, 0.000_01));
}

export function estimateSoundLevel(decibelsFullScale: number): number {
  return Math.min(120, Math.max(20, decibelsFullScale + 100));
}

export function soundContext(decibels: number): SoundContext {
  if (decibels < 35)
    return { label: 'Very quiet', detail: 'Library or quiet room', caution: false };
  if (decibels < 50)
    return { label: 'Calm', detail: 'Soft conversation or quiet home', caution: false };
  if (decibels < 65)
    return { label: 'Conversation', detail: 'Typical speaking level', caution: false };
  if (decibels < 80)
    return { label: 'Busy', detail: 'Traffic or a lively restaurant', caution: false };
  if (decibels < 85) return { label: 'Loud', detail: 'Limit prolonged exposure', caution: false };
  if (decibels < 100)
    return { label: 'Hearing risk', detail: 'Protection is advisable', caution: true };
  return { label: 'Very hazardous', detail: 'Move away or protect your hearing', caution: true };
}

export function compactSpectrum(values: Uint8Array, bandCount = 24): number[] {
  if (values.length === 0 || bandCount <= 0) return [];
  const bands: number[] = [];
  const lastIndex = values.length - 1;
  for (let band = 0; band < bandCount; band += 1) {
    const start = Math.max(1, Math.floor(Math.exp((band / bandCount) * Math.log(values.length))));
    const end = Math.max(
      start + 1,
      Math.floor(Math.exp(((band + 1) / bandCount) * Math.log(values.length))),
    );
    let peak = 0;
    for (let index = start; index < Math.min(end, lastIndex + 1); index += 1) {
      peak = Math.max(peak, values[index] ?? 0);
    }
    bands.push(peak / 255);
  }
  return bands;
}
