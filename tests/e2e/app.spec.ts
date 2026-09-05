import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

async function createServiceReceipt(page: import('@playwright/test').Page, project = 'Autumn campaign files'): Promise<void> {
  await page.getByLabel('Project or engagement').fill(project);
  await page.getByLabel('Your name or studio').fill('Mara Vale Studio');
  await page.getByLabel('Client name').fill('Evergreen Goods');
  await page.getByPlaceholder('e.g. Final strategy workshop').fill('Final art direction and handoff');
  await page.getByRole('button', { name: 'Add service' }).click();
  await page.getByRole('button', { name: 'Seal this delivery' }).click();
  await expect(page.getByRole('heading', { name: 'Send this receipt with the delivery' })).toBeVisible();
}

async function downloadBuffer(download: import('@playwright/test').Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error('Download has no file path');
  return readFile(path);
}

test('@claim:demo-sandbox opens a completed sample and keeps real records unchanged', async ({ page }) => {
  await page.goto('/');
  await createServiceReceipt(page, 'Real client handoff');
  await page.goto('/demo');
  await expect(page.getByText('Demo — sample data, nothing is saved to real records')).toBeVisible();
  await expect(page.getByText('Northstar Coffee launch')).toBeVisible();
  await expect(page.getByText('Accepted by Inez Rahman')).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Northstar Coffee launch')).toBeVisible();
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.getByText('Real client handoff')).toBeVisible();
  await expect(page.getByText('Northstar Coffee launch')).toHaveCount(0);
});

test('@claim:local-file-hash fingerprints selected bytes with SHA-256 without outgoing data requests', async ({ page, baseURL }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  const bytes = Buffer.from('a private draft with a known hash');
  const expectedHash = createHash('sha256').update(bytes).digest('hex');
  await page.goto('/demo');
  await page.getByLabel('Project or engagement').fill('File fingerprint check');
  await page.getByLabel('Your name or studio').fill('Mara Vale Studio');
  await page.getByLabel('Client name').fill('Evergreen Goods');
  await page.locator('#file-input').setInputFiles({ name: 'private-draft.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(page.getByText('private-draft.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Seal this delivery' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const receipt = JSON.parse((await downloadBuffer(await download)).toString()) as { deliverables: Array<{ sha256?: string }> };
  expect(receipt.deliverables[0].sha256).toBe(expectedHash);
  const acknowledgement = await page.getByLabel('Client acknowledgement link').inputValue();
  expect(acknowledgement).not.toContain(bytes.toString());
  expect(requested.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
});

test('@claim:acknowledgement-page opens a separate client page with a fixed delivery list', async ({ page }) => {
  await page.goto('/demo');
  const link = await page.getByLabel('Client acknowledgement link').inputValue();
  expect(link).toContain('/ack/demo/');
  await page.goto(link);
  await expect(page).toHaveTitle('Client acknowledgement — Delivery Receipt');
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('Northstar-brand-guidelines.pdf')).toBeVisible();
  await expect(page.locator('.ack-sheet input, .ack-sheet textarea')).toHaveCount(0);
});

test('@claim:response-bound records an acceptance bound to the exact receipt and manifest', async ({ page, browser }) => {
  await page.goto('/demo');
  await createServiceReceipt(page, 'Claim acceptance receipt');
  const acknowledgement = await page.getByLabel('Client acknowledgement link').inputValue();
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(acknowledgement);
  await clientPage.getByLabel('Accept delivery record').check();
  await clientPage.getByLabel('Your name').fill('Inez Client');
  await clientPage.getByLabel(/I reviewed receipt/).check();
  await clientPage.getByRole('button', { name: 'Record my response' }).click();
  const responseCode = await clientPage.getByLabel('Response code').inputValue();
  expect(responseCode.length).toBeGreaterThan(100);
  const response = JSON.parse(Buffer.from(responseCode.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString()) as { receiptId: string; manifestHash: string; decision: string; clientName: string; respondedAt: string };
  expect(response).toMatchObject({ decision: 'accepted', clientName: 'Inez Client' });
  expect(response.receiptId).toMatch(/^DR-/);
  expect(response.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  expect(new Date(response.respondedAt).toISOString()).toBe(response.respondedAt);
  await clientContext.close();
  await page.getByLabel('Client response code').fill(responseCode);
  await page.getByRole('button', { name: 'Verify response' }).click();
  await expect(page.getByText('Accepted by Inez Client')).toBeVisible();
  await expect(page.getByText('Verified: the client accepted this exact manifest.')).toBeVisible();
});

test('@claim:pdf-export downloads a readable receipt PDF', async ({ page }) => {
  await page.goto('/demo');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const bytes = await downloadBuffer(await download);
  expect(bytes.subarray(0, 8).toString()).toBe('%PDF-1.4');
  expect(bytes.toString()).toContain('MANIFEST SHA-256');
});

test('@claim:archive-transfer exports a full JSON archive and restores it after deletion', async ({ page }) => {
  await page.goto('/demo');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all JSON' }).click();
  const archive = await downloadBuffer(await download);
  const decoded = JSON.parse(archive.toString()) as { receipts: unknown[]; responses: unknown[] };
  expect(decoded.receipts).toHaveLength(1);
  expect(decoded.responses).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete receipt for Northstar Coffee launch' }).click();
  await expect(page.getByText('No saved receipts yet.')).toBeVisible();
  await page.locator('#import-all').setInputFiles({ name: 'delivery-receipts.json', mimeType: 'application/json', buffer: archive });
  await expect(page.getByText('Northstar Coffee launch')).toBeVisible();
  await expect(page.getByText('Accepted by Inez Rahman')).toBeVisible();
});

test('@claim:browser-persistence keeps sample receipts until they are deleted', async ({ page }) => {
  await page.goto('/demo');
  await page.reload();
  await expect(page.getByText('Northstar Coffee launch')).toBeVisible();
  await expect(page.getByText('Demo — sample data, nothing is saved to real records')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete receipt for Northstar Coffee launch' }).click();
  await expect(page.getByText('No saved receipts yet.')).toBeVisible();
});

test('@claim:offline-reload creates a receipt offline after the first visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/demo');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You are offline. Receipts, responses, and PDF exports still work.')).toBeVisible();
  await createServiceReceipt(page, 'Offline delivery record');
  await expect(page.getByRole('heading', { name: 'Send this receipt with the delivery' })).toBeVisible();
  await context.close();
});

test('@claim:local-only needs no account and sends the demo flow only to this site', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await expect(page.getByText('No account needed')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /email|password|account/i })).toHaveCount(0);
  expect(requests.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
});

test('rejects malformed archives without changing a working local receipt', async ({ page }) => {
  await page.goto('/');
  await createServiceReceipt(page, 'Protected receipt');
  const recordDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const validRecord = JSON.parse((await downloadBuffer(await recordDownload)).toString()) as Record<string, unknown>;
  const acceptedWithoutResponse = { ...validRecord, status: 'accepted' };
  const malformedArchives = [
    { product: 'delivery-acceptance-receipt', exportedAt: '2026-09-05T00:00:00.000Z', receipts: [{ id: 'QA-MALFORMED-1' }], responses: [] },
    { product: 'delivery-acceptance-receipt', exportedAt: '2026-09-05T00:00:00.000Z', receipts: [acceptedWithoutResponse], responses: [] }
  ];
  for (const [index, archive] of malformedArchives.entries()) {
    await page.locator('#import-all').setInputFiles({ name: `broken-${index}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) });
    await expect(page.getByText(/That archive has an invalid receipt or response/)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText('Protected receipt')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Local storage could not open' })).toHaveCount(0);
});

test('rejects whitespace-only identities and a damaged acknowledgement route', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Project or engagement').fill('   ');
  await page.getByLabel('Your name or studio').fill('Mara Vale Studio');
  await page.getByLabel('Client name').fill('Evergreen Goods');
  await page.getByPlaceholder('e.g. Final strategy workshop').fill('Completed handoff');
  await page.getByRole('button', { name: 'Add service' }).click();
  await page.getByRole('button', { name: 'Seal this delivery' }).click();
  await expect(page.getByText('Project or engagement cannot be blank. Enter a value before sealing.')).toBeVisible();
  await expect(page.getByLabel('Project or engagement')).toBeFocused();
  await page.goto('/ack/not-a-record');
  await expect(page).toHaveTitle('Acknowledgement link — Delivery Receipt');
  await expect(page.getByRole('heading', { name: 'This acknowledgement link is damaged' })).toBeVisible();
});

test('records a client decline and verifies its response code', async ({ page, browser }) => {
  await page.goto('/');
  await createServiceReceipt(page, 'Declined delivery record');
  const acknowledgement = await page.getByLabel('Client acknowledgement link').inputValue();
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(acknowledgement);
  await clientPage.getByLabel('Decline delivery record').check();
  await clientPage.getByLabel('Your name').fill('Inez Client');
  await clientPage.getByLabel('Response note').fill('The final source files are missing.');
  await clientPage.getByLabel(/I reviewed receipt/).check();
  await clientPage.getByRole('button', { name: 'Record my response' }).click();
  const responseCode = await clientPage.getByLabel('Response code').inputValue();
  await clientContext.close();
  await page.getByLabel('Client response code').fill(responseCode);
  await page.getByRole('button', { name: 'Verify response' }).click();
  await expect(page.getByText('Declined by Inez Client')).toBeVisible();
  await expect(page.getByText('Verified: the client declined this exact manifest.')).toBeVisible();
});

test('has no serious accessibility findings, has route titles, and fits at phone width', async ({ page }, testInfo) => {
  for (const path of ['/', '/demo', '/privacy/', '/terms/']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const results = await new AxeBuilder({ page: page as never }).analyze();
    const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
  }
  await page.goto('/demo');
  await expect(page).toHaveTitle('Demo — Delivery Receipt');
  test.skip(testInfo.project.name !== 'mobile', 'Mobile project only');
  const sizes = await page.locator('footer a').evaluateAll((links) => links.map((link) => ({ width: link.getBoundingClientRect().width, height: link.getBoundingClientRect().height })));
  expect(sizes.every((size) => size.width >= 44 && size.height >= 44)).toBe(true);
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test('uses a real 404 page and offers recovery', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page).toHaveTitle('Page not found — Delivery Receipt');
  await expect(page.getByRole('heading', { name: 'This page is not available' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Delivery Receipt' })).toHaveAttribute('href', '/');
});
