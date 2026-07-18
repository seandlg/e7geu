export type RgbColor = { red: number; green: number; blue: number };
export type HslColor = { hue: number; saturation: number; lightness: number };
export type PixelPoint = { x: number; y: number };
export type DisplayBounds = { left: number; top: number; width: number; height: number };

export function clientPointToPixel(
  clientX: number,
  clientY: number,
  bounds: DisplayBounds,
  imageWidth: number,
  imageHeight: number,
): PixelPoint | null {
  if (bounds.width <= 0 || bounds.height <= 0 || imageWidth <= 0 || imageHeight <= 0) return null;
  const normalizedX = Math.min(0.999_999, Math.max(0, (clientX - bounds.left) / bounds.width));
  const normalizedY = Math.min(0.999_999, Math.max(0, (clientY - bounds.top) / bounds.height));
  return {
    x: Math.floor(normalizedX * imageWidth),
    y: Math.floor(normalizedY * imageHeight),
  };
}

export function nudgePixel(
  point: PixelPoint,
  deltaX: number,
  deltaY: number,
  imageWidth: number,
  imageHeight: number,
): PixelPoint {
  return {
    x: Math.min(imageWidth - 1, Math.max(0, point.x + deltaX)),
    y: Math.min(imageHeight - 1, Math.max(0, point.y + deltaY)),
  };
}

export function rgbToHex({ red, green, blue }: RgbColor): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

export function rgbToHsl({ red, green, blue }: RgbColor): HslColor {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;

  if (difference !== 0) {
    if (maximum === r) hue = ((g - b) / difference) % 6;
    else if (maximum === g) hue = (b - r) / difference + 2;
    else hue = (r - g) / difference + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = difference === 0 ? 0 : difference / (1 - Math.abs(2 * lightness - 1));
  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
}

export function averagePixels(data: Uint8ClampedArray): RgbColor | null {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) === 0) continue;
    red += data[index] ?? 0;
    green += data[index + 1] ?? 0;
    blue += data[index + 2] ?? 0;
    count += 1;
  }
  if (count === 0) return null;
  return {
    red: Math.round(red / count),
    green: Math.round(green / count),
    blue: Math.round(blue / count),
  };
}

export function contrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function relativeLuminance(color: RgbColor): number {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
