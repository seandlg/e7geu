import { describe, expect, it } from 'vite-plus/test';
import { modelSizeLabel, outputFilename, validateImageFile } from './image.ts';

describe('background remover image settings', () => {
  it('describes the consent-gated model download in binary units', () => {
    expect(modelSizeLabel()).toBe('4.4 MiB');
  });

  it('creates a PNG result name without losing dotted stems', () => {
    expect(outputFilename('portrait.final.jpeg')).toBe('portrait.final-background-removed.png');
    expect(outputFilename('.portrait')).toBe('.portrait-background-removed.png');
  });

  it('accepts non-empty images and rejects other files', () => {
    expect(validateImageFile(new File(['image'], 'photo.webp', { type: 'image/webp' }))).toBeNull();
    expect(validateImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toMatch(
      /image file/,
    );
    expect(validateImageFile(new File([], 'empty.png', { type: 'image/png' }))).toMatch(/empty/);
  });
});
