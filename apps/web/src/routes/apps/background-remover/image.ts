export const MODEL_BYTES = 4_574_861;

export function modelSizeLabel(bytes = MODEL_BYTES): string {
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

export function outputFilename(sourceName: string): string {
  const finalDot = sourceName.lastIndexOf('.');
  const stem = (finalDot > 0 ? sourceName.slice(0, finalDot) : sourceName).trim() || 'image';
  return `${stem}-background-removed.png`;
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Choose an image file.';
  if (file.size === 0) return 'This image is empty.';
  return null;
}
