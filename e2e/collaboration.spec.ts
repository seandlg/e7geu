import { expect, test } from '@playwright/test';

test('loads the collaboration room and its checked-in Wasm bridge', async ({ page }) => {
  await page.goto('/apps/collaboration');

  await expect(page.getByRole('heading', { name: 'Open a room' })).toBeVisible();
  await page.getByRole('button', { name: 'Create private room' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter your name');

  const exports = await page.evaluate(async () => {
    const modulePath = '/iroh/collaboration_iroh.js';
    const wasm = (await import(modulePath)) as {
      default(): Promise<unknown>;
      CollaborationNode: { spawn: unknown };
    };
    await wasm.default();
    return typeof wasm.CollaborationNode.spawn;
  });
  expect(exports).toBe('function');
});
