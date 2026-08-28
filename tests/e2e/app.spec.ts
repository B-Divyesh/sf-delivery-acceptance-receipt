import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('creates a delivery, gets a client answer, and verifies it', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await page.getByLabel('Project or engagement *').fill('Autumn campaign files');
  await page.getByLabel('Your name or studio *').fill('Mara Vale Studio');
  await page.getByLabel('Client name *').fill('Evergreen Goods');
  await page.getByPlaceholder('e.g. Final strategy workshop').fill('Final art direction and handoff');
  await page.getByRole('button', { name: 'Add service' }).click();
  await page.getByRole('button', { name: 'Seal this delivery' }).click();
  await expect(page.getByRole('heading', { name: 'Receipt ready to hand over' })).toBeVisible();

  const acknowledgementUrl = await page.getByLabel('Client acknowledgement link').inputValue();
  expect(acknowledgementUrl).toContain('#ack=');
  await page.goto(acknowledgementUrl);
  await expect(page.getByRole('heading', { name: 'Review the handoff.' })).toBeVisible();
  await expect(page.getByText('Final art direction and handoff')).toBeVisible();
  await page.getByLabel('Accept delivery record').check();
  await page.getByLabel('Your name *').fill('Inez Client');
  await page.getByLabel(/I reviewed receipt/).check();
  await page.getByRole('button', { name: 'Record my response' }).click();
  const responseCode = await page.getByLabel('Response code').inputValue();
  expect(responseCode.length).toBeGreaterThan(100);

  await page.goto('/');
  await page.getByRole('button', { name: /Autumn campaign files Evergreen Goods/ }).click();
  await page.getByLabel('Client response code').fill(responseCode);
  await page.getByRole('button', { name: 'Verify response' }).click();
  await expect(page.getByText('Accepted by Inez Client')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  expect(errors).toEqual([]);
});

test('rejects whitespace-only identities and every sealed receipt opens for acknowledgement', async ({ page }) => {
  await page.goto('/');
  const fields = [
    { label: 'Project or engagement *', value: 'Identity launch', message: 'Project or engagement cannot be blank. Enter a value before sealing.' },
    { label: 'Your name or studio *', value: 'North Studio', message: 'Your name or studio cannot be blank. Enter a value before sealing.' },
    { label: 'Client name *', value: 'Sample Client', message: 'Client name cannot be blank. Enter a value before sealing.' }
  ];
  for (const field of fields) await page.getByLabel(field.label).fill(field.value);
  await page.getByPlaceholder('e.g. Final strategy workshop').fill('Completed identity handoff');
  await page.getByRole('button', { name: 'Add service' }).click();

  for (const field of fields) {
    const input = page.getByLabel(field.label);
    await input.fill('   ');
    await page.getByRole('button', { name: 'Seal this delivery' }).click();
    await expect(page.getByRole('heading', { name: 'Receipt ready to hand over' })).toHaveCount(0);
    await expect(page.locator('.toast')).toHaveText(field.message);
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill(field.value);
  }

  await page.getByRole('button', { name: 'Seal this delivery' }).click();
  await expect(page.getByRole('heading', { name: 'Receipt ready to hand over' })).toBeVisible();
  const acknowledgementUrl = await page.getByLabel('Client acknowledgement link').inputValue();
  await page.goto(acknowledgementUrl);
  await expect(page.getByRole('heading', { name: 'Review the handoff.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This handoff link is damaged.' })).toHaveCount(0);

  await page.getByLabel('Accept delivery record').check();
  await page.getByLabel('Your name *').fill('   ');
  await page.getByLabel(/I reviewed receipt/).check();
  await page.getByRole('button', { name: 'Record my response' }).click();
  await expect(page.getByLabel('Your name *')).toBeFocused();
  await expect(page.locator('.toast')).toHaveText('Your name cannot be blank. Enter a name before recording the response.');
  await expect(page.getByRole('heading', { name: 'Send this answer back.' })).toHaveCount(0);
});

test('has no serious accessibility findings on core and legal screens', async ({ page }) => {
  for (const path of ['/', '/privacy/', '/terms/']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const results = await new AxeBuilder({ page: page as never }).analyze();
    const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
  }
});

test('retains the app shell and local tools offline', async ({ page, context }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(`${request.url()} — ${request.failure()?.errorText}`));
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  const cached = await page.evaluate(async () => ({ css: Boolean(await caches.match('/assets/app.css')), js: Boolean(await caches.match('/assets/main.js')) }));
  expect(cached).toEqual({ css: true, js: true });
  await context.setOffline(true);
  await page.reload();
  expect(errors).toEqual([]);
  await expect(page.getByRole('heading', { name: /Deliver the work/ }), failed.join('\n')).toBeVisible();
  await expect(page.getByText(/Offline deck/)).toBeVisible();
});

test('fits the core workflow at 390px without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile project only');
  await page.goto('/');
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  await expect(page.getByRole('button', { name: 'Seal this delivery' })).toBeVisible();
});
