export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export type ImageDimensions = {
  width: number;
  height: number;
};

export type CropRectangle = ImageDimensions & {
  x: number;
  y: number;
};

export const MAX_OUTPUT_DIMENSION = 16_384;
export const MAX_OUTPUT_PIXELS = 40_000_000;

const extensions: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function defaultOutputDimensions(source: ImageDimensions): ImageDimensions {
  return fitWithin(source, 2_048, 2_048);
}

export function fitWithin(
  source: ImageDimensions,
  maximumWidth: number,
  maximumHeight: number,
): ImageDimensions {
  const scale = Math.min(maximumWidth / source.width, maximumHeight / source.height, 1);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

export function cropRectangle(
  source: ImageDimensions,
  ratio: number | null,
  horizontalPosition = 0.5,
  verticalPosition = 0.5,
): CropRectangle {
  if (!ratio) return { x: 0, y: 0, width: source.width, height: source.height };

  const sourceRatio = source.width / source.height;
  if (sourceRatio > ratio) {
    const width = Math.round(source.height * ratio);
    return {
      x: Math.round((source.width - width) * clampPosition(horizontalPosition)),
      y: 0,
      width,
      height: source.height,
    };
  }

  const height = Math.round(source.width / ratio);
  return {
    x: 0,
    y: Math.round((source.height - height) * clampPosition(verticalPosition)),
    width: source.width,
    height,
  };
}

export function validateDimensions(dimensions: ImageDimensions): string | null {
  if (
    !Number.isInteger(dimensions.width) ||
    !Number.isInteger(dimensions.height) ||
    dimensions.width < 1 ||
    dimensions.height < 1
  ) {
    return 'Width and height must be whole numbers greater than zero.';
  }
  if (dimensions.width > MAX_OUTPUT_DIMENSION || dimensions.height > MAX_OUTPUT_DIMENSION) {
    return `Width and height must be ${MAX_OUTPUT_DIMENSION.toLocaleString('en')} px or less.`;
  }
  if (dimensions.width * dimensions.height > MAX_OUTPUT_PIXELS) {
    return 'The output is too large to process safely. Use fewer than 40 megapixels.';
  }
  return null;
}

export function preferredFormat(sourceType: string): OutputFormat {
  if (sourceType === 'image/png' || sourceType === 'image/webp') return sourceType;
  return 'image/jpeg';
}

export function outputFilename(sourceName: string, format: OutputFormat): string {
  const finalDot = sourceName.lastIndexOf('.');
  const stem = (finalDot > 0 ? sourceName.slice(0, finalDot) : sourceName).trim() || 'image';
  return `${stem}-optimized.${extensions[format]}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

export function sizeDifference(originalBytes: number, outputBytes: number): string {
  if (originalBytes === outputBytes) return 'Same file size';
  const percentage = Math.round((Math.abs(originalBytes - outputBytes) / originalBytes) * 100);
  return outputBytes < originalBytes ? `${percentage}% smaller` : `${percentage}% larger`;
}

function clampPosition(position: number): number {
  return Math.min(1, Math.max(0, position));
}
