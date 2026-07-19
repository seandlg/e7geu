import type { CropRectangle, ImageDimensions, OutputFormat } from './image.ts';

export type LoadedImage = ImageDimensions & {
  bitmap: ImageBitmap;
};

export async function loadImage(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    throw new Error('This image format is not supported by your browser. Try JPEG, PNG, or WebP.');
  }
}

export async function processImage(
  source: ImageBitmap,
  crop: CropRectangle,
  dimensions: ImageDimensions,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (format === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    dimensions.width,
    dimensions.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, format, format === 'image/png' ? undefined : quality);
  });
  canvas.width = 1;
  canvas.height = 1;

  if (!blob) throw new Error('The image could not be exported. Try smaller dimensions.');
  if (blob.type !== format) {
    throw new Error(`${formatLabel(format)} export is not supported by this browser.`);
  }
  return blob;
}

function formatLabel(format: OutputFormat): string {
  if (format === 'image/jpeg') return 'JPEG';
  if (format === 'image/png') return 'PNG';
  return 'WebP';
}
