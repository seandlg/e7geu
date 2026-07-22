import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixture = fileURLToPath(
  new URL('../apps/web/static/images/berlin-work-cafes-hero.webp', import.meta.url),
);

test('removes a background locally after explicit download consent', async ({
  browserName,
  page,
}) => {
  const pageErrors: string[] = [];
  const aiRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/ai/')) aiRequests.push(url.pathname);
  });

  await page.goto('/apps/background-remover');
  await page.waitForTimeout(250);
  await page.locator('input[type="file"]').setInputFiles(fixture);

  expect(pageErrors).toEqual([]);
  expect(aiRequests).toEqual([]);
  await page.getByRole('button', { name: 'Download 4.4 MiB AI model' }).click();
  const removeButton = page.getByRole('button', { name: 'Remove background' });
  const alert = page.getByRole('alert');
  await expect(removeButton.or(alert)).toBeVisible();
  await expect(alert).toBeHidden();
  await expect(removeButton).toBeVisible();

  const expectedAiRequests = [
    '/ai/runtime/ort-wasm-simd-threaded.wasm',
    '/ai/u2netp/onnx/model.onnx',
  ];
  if (browserName === 'chromium') {
    expectedAiRequests.push('/ai/runtime/ort-wasm-simd-threaded.mjs');
  }
  expect(new Set(aiRequests)).toEqual(new Set(expectedAiRequests));

  await removeButton.click();
  const result = page.getByRole('img', { name: 'Background removed preview' });
  await expect(result).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PNG' })).toBeVisible();

  const alphaRange = await result.evaluate(async (image: HTMLImageElement) => {
    const response = await fetch(image.src);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minimum = 255;
    let maximum = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      minimum = Math.min(minimum, pixels[index]);
      maximum = Math.max(maximum, pixels[index]);
    }
    return { minimum, maximum };
  });

  expect(alphaRange.minimum).toBeLessThan(255);
  expect(alphaRange.maximum).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});
