import './style.css';
import { decodePortable, encodePortable, hashFile, makeResponseHash, manifestHash, verifyReceipt, verifyResponse } from './crypto';
import { deleteReceipt, ensureDemoData, exportBundle, getReceipts, getResponses, importBundle, resetDemoData, saveReceipt, saveResponse, setStorageMode } from './db';
import { downloadBytes, receiptPdf } from './pdf';
import type { ClientResponse, Deliverable, PublicReceipt, ReceiptRecord } from './types';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root is missing');
const app: HTMLDivElement = appRoot;

const buildId = 'v1.1.0';
const today = new Date().toISOString().slice(0, 10);
const state: {
  isDemo: boolean;
  deliverables: Deliverable[];
  records: ReceiptRecord[];
  current?: ReceiptRecord;
  ackResponse?: ClientResponse;
  message: string;
  error: string;
  hashing: string;
  draft: Record<string, string>;
} = {
  isDemo: false,
  deliverables: [],
  records: [],
  message: '',
  error: '',
  hashing: '',
  draft: { project: '', freelancer: '', client: '', deliveryDate: today, dueDate: '', note: '', service: '' }
};

const e = (value: unknown): string => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character] ?? character);
const formatBytes = (bytes = 0): string => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const shortHash = (hash = ''): string => `${hash.slice(0, 12)}…${hash.slice(-12)}`;
const randomId = (): string => `DR-${today.replaceAll('-', '')}-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const requiredReceiptText = [
  { name: 'project', label: 'Project or engagement' },
  { name: 'freelancer', label: 'Your name or studio' },
  { name: 'client', label: 'Client name' }
] as const;

function publicPart(record: ReceiptRecord): PublicReceipt {
  const { status: _status, response: _response, ...receipt } = record;
  return receipt;
}

function acknowledgementUrl(receipt: PublicReceipt): string {
  const prefix = state.isDemo ? '/ack/demo/' : '/ack/';
  return `${location.origin}${prefix}${encodePortable(receipt)}`;
}

function shell(content: string): string {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="Delivery Receipt home">
        <svg viewBox="0 0 44 32" aria-hidden="true"><rect x="1.5" y="2" width="41" height="28"/><circle cx="14" cy="15" r="5"/><circle cx="30" cy="15" r="5"/><path d="M12 25h20"/></svg>
        <span>Delivery<br>Receipt</span>
      </a>
      <nav aria-label="Primary"><a href="/demo">Demo</a><a href="/#make">Create</a><a href="/#records">Records</a><a href="/privacy/">Privacy</a></nav>
      <span class="network-status" data-online>${navigator.onLine ? '● Online' : '× Offline'}</span>
    </header>
    ${state.isDemo ? '<aside class="demo-banner" aria-label="Sample mode"><strong>Demo — sample data, nothing is saved to real records</strong><button class="text-button" type="button" data-reset-demo>Reset demo</button><a href="/">Start for real</a></aside>' : ''}
    ${!navigator.onLine ? '<div class="offline-strip" role="status">You are offline. Receipts, responses, and PDF exports still work.</div>' : ''}
    ${content}
    <footer>
      <p>Record deliveries and client responses on this device.</p>
      <nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav>
      <p class="generated-note">Built by Param Factory · ${buildId} · Original generated receipt artwork</p>
    </footer>
    <div class="toast ${state.error ? 'toast-error' : ''}" role="status" aria-live="polite" aria-atomic="true">${e(state.error || state.message || state.hashing)}</div>
    <div class="route-announcer visually-hidden" aria-live="polite" aria-atomic="true"></div>`;
}

function setRoute(title: string, description: string, canonicalPath: string, announcement: string, noIndex = false): void {
  document.title = title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', `${location.origin}${canonicalPath}`);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', `${location.origin}${canonicalPath}`);
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (noIndex && !robots) {
    robots = document.createElement('meta');
    robots.name = 'robots';
    document.head.append(robots);
  }
  if (robots) robots.content = noIndex ? 'noindex, nofollow' : 'index, follow';
  queueMicrotask(() => {
    const heading = app.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    const announcer = app.querySelector<HTMLElement>('.route-announcer');
    if (announcer) announcer.textContent = announcement;
  });
}

function setNotice(message: string, error = false): void {
  state.message = error ? '' : message;
  state.error = error ? message : '';
  const toast = app.querySelector<HTMLDivElement>('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('toast-error', error);
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 5000);
}

async function copyText(text: string, success: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.className = 'clipboard-fallback';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  setNotice(success);
}

function deliverableRows(items: Deliverable[], removable = false): string {
  if (!items.length) return '<div class="empty-slot"><span aria-hidden="true">＋</span><p>No delivery items yet. Add file fingerprints or a completed service.</p></div>';
  return `<ol class="manifest-list">${items.map((item, index) => `
    <li class="manifest-row">
      <span class="track">${String(index + 1).padStart(2, '0')}</span>
      <span class="kind">${e(item.kind)}</span>
      <span class="item-name">${e(item.name)}</span>
      ${item.kind === 'file' ? `<span class="file-meta">${formatBytes(item.size)} · SHA-256 <span title="${e(item.sha256)}">${shortHash(item.sha256)}</span></span>` : '<span class="file-meta">Completed service</span>'}
      ${removable ? `<button class="icon-button" type="button" data-remove="${e(item.id)}" aria-label="Remove ${e(item.name)}">×</button>` : ''}
    </li>`).join('')}</ol>`;
}

function responseSummary(response: ClientResponse): string {
  return `<div class="response-summary response-${e(response.decision)}"><div><span class="section-kicker">Client response</span><h3>${response.decision === 'accepted' ? 'Accepted by' : 'Declined by'} ${e(response.clientName)}</h3><p>${e(response.respondedAt)}${response.note ? ` · “${e(response.note)}”` : ''}</p></div><span class="status-stamp status-${e(response.decision)}">${e(response.decision)}</span></div>`;
}

function receiptPanel(record: ReceiptRecord): string {
  const receipt = publicPart(record);
  const url = acknowledgementUrl(receipt);
  return `<section class="sealed-sheet" aria-labelledby="sealed-title">
    <div class="section-kicker">Receipt ready</div>
    <div class="sheet-heading"><div><h2 id="sealed-title">Send this receipt with the delivery</h2><p>The link contains the manifest and its hash. It never contains file bytes.</p></div><span class="status-stamp status-${e(record.status)}">${e(record.status)}</span></div>
    <dl class="receipt-facts"><div><dt>Receipt</dt><dd>${e(record.id)}</dd></div><div><dt>Manifest SHA-256</dt><dd class="hash">${e(record.manifestHash)}</dd></div><div><dt>Client</dt><dd>${e(record.client)}</dd></div><div><dt>Delivery</dt><dd>${e(record.deliveryDate)}</dd></div></dl>
    <label for="share-link">Client acknowledgement link</label>
    <div class="copy-row"><input id="share-link" readonly value="${e(url)}"><button class="button button-primary" type="button" data-copy-link>Copy link</button></div>
    <p class="field-hint">Send this link with the actual files. Your client can review the fixed manifest and send back a response code.</p>
    <div class="action-row"><button class="button" type="button" data-share-link>Share acknowledgement</button><button class="button" type="button" data-download-pdf>Download PDF</button><button class="button button-quiet" type="button" data-download-record>Download JSON</button></div>
    ${record.response ? responseSummary(record.response) : `<form class="response-import" data-response-form><h3>Verify a client response</h3><p>Paste the response code your client sends. The app checks it against this receipt and manifest.</p><label for="response-code">Client response code</label><textarea id="response-code" name="responseCode" rows="3" required spellcheck="false"></textarea><button class="button button-primary" type="submit">Verify response</button></form>`}
  </section>`;
}

function recordsMarkup(): string {
  const sorted = [...state.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!sorted.length) return '<div class="records-empty"><p class="empty-title">No saved receipts yet.</p><p>Create a receipt above. It remains in this browser until you delete it.</p></div>';
  return `<div class="record-stack">${sorted.map((record) => `<article class="record-card"><button type="button" class="record-open" data-open-record="${e(record.id)}"><span class="status-dot status-${e(record.status)}" aria-hidden="true"></span><span><strong>${e(record.project)}</strong><small>${e(record.client)} · ${e(record.deliveryDate)}</small></span><span class="record-status">${e(record.status)}</span></button><button class="icon-button" type="button" data-delete-record="${e(record.id)}" aria-label="Delete receipt for ${e(record.project)}">×</button></article>`).join('')}</div>`;
}

function renderHome(): void {
  app.innerHTML = shell(`<main id="main">
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy"><p class="eyebrow">Delivery receipt for freelancers</p><h1 id="page-title">Record delivered work and client acceptance</h1><p class="lede">For freelancers who need a clear handoff record before a final invoice or payment dispute.</p><div class="hero-actions"><a class="button button-primary button-big" href="/demo">Try it with sample data</a><span>Opens a completed sample receipt.</span></div><a class="secondary-action" href="/#make">Make a receipt with my delivery</a><ul class="trust-line"><li>Files stay on this device</li><li>No account needed</li><li>Works offline after the first visit</li></ul></div>
      <figure class="hero-art"><picture><source media="(max-width: 700px)" srcset="/assets/hero-cassette-720.avif" type="image/avif"><source srcset="/assets/hero-cassette-1200.avif" type="image/avif"><source media="(max-width: 700px)" srcset="/assets/hero-cassette-720.webp" type="image/webp"><source srcset="/assets/hero-cassette-1200.webp" type="image/webp"><img src="/assets/hero-cassette.jpg" width="1200" height="800" fetchpriority="high" alt="A cassette-shaped delivery receipt beside a checklist and acceptance stamp"></picture><figcaption>Delivery receipt illustration</figcaption></figure>
    </section>
    <section id="make" class="maker" aria-labelledby="make-title">
      <div class="maker-intro"><span class="section-kicker">Create a receipt</span><h2 id="make-title">List what you delivered</h2><p>Select files to fingerprint them in this browser. Or add a completed service.</p></div>
      <form class="receipt-form" data-receipt-form novalidate>
        <div class="form-grid"><div class="field field-wide"><label for="project">Project or engagement <span aria-hidden="true">*</span></label><input id="project" name="project" required maxlength="100" value="${e(state.draft.project)}" autocomplete="off"><p class="field-hint">Example: Brand launch files</p></div><div class="field"><label for="freelancer">Your name or studio <span aria-hidden="true">*</span></label><input id="freelancer" name="freelancer" required maxlength="100" value="${e(state.draft.freelancer)}" autocomplete="organization"></div><div class="field"><label for="client">Client name <span aria-hidden="true">*</span></label><input id="client" name="client" required maxlength="100" value="${e(state.draft.client)}" autocomplete="organization"></div><div class="field"><label for="delivery-date">Delivery date <span aria-hidden="true">*</span></label><input id="delivery-date" name="deliveryDate" required type="date" value="${e(state.draft.deliveryDate)}"></div><div class="field"><label for="due-date">Final invoice due <span class="optional">optional</span></label><input id="due-date" name="dueDate" type="date" value="${e(state.draft.dueDate)}"></div></div>
        <fieldset class="tracks"><legend>Delivery items <span aria-hidden="true">*</span></legend><div class="track-actions"><label class="button file-button" for="file-input">Fingerprint files</label><input class="visually-hidden" id="file-input" type="file" multiple><span class="or">or</span><div class="service-add"><label class="visually-hidden" for="service-item">Completed service</label><input id="service-item" name="service" maxlength="120" value="${e(state.draft.service)}" placeholder="e.g. Final strategy workshop"><button class="button" type="button" data-add-service>Add service</button></div></div><div class="hash-progress" aria-live="polite">${e(state.hashing)}</div>${deliverableRows(state.deliverables, true)}</fieldset>
        <div class="field"><label for="note">Handoff note <span class="optional">optional</span></label><textarea id="note" name="note" maxlength="800" rows="4">${e(state.draft.note)}</textarea><p class="field-hint">Include a delivery channel, revision round, or contract reference. Do not include secrets.</p></div><p class="evidence-note"><strong>Evidence only.</strong> This receipt does not hold work, collect money, or replace your contract. Legal effect depends on your agreement and jurisdiction.</p><button class="button button-primary button-big" type="submit">Seal this delivery</button>
      </form>
    </section>
    ${state.current ? receiptPanel(state.current) : ''}
    <section id="records" class="records-section" aria-labelledby="records-title"><div class="section-heading"><div><span class="section-kicker">Local records</span><h2 id="records-title">Saved receipts</h2></div><div class="action-row"><button class="button button-quiet" type="button" data-export-all>Export all JSON</button><label class="button button-quiet" for="import-all">Import JSON</label><input class="visually-hidden" id="import-all" type="file" accept="application/json"></div></div>${recordsMarkup()}</section>
    <section class="how-section" aria-labelledby="how-title"><div><span class="section-kicker">Three steps</span><h2 id="how-title">How the receipt works</h2></div><ol><li><strong>Fingerprint files.</strong><span>File hashes identify selected bytes without uploading the files.</span></li><li><strong>Send the delivery.</strong><span>Use your usual drive or email for the actual files and send the acknowledgement link.</span></li><li><strong>Save the response.</strong><span>The client’s acceptance or decline includes the receipt, manifest hash, name, and UTC time.</span></li></ol></section>
    <section class="limits-section" aria-labelledby="limits-title"><span class="section-kicker">Privacy and limits</span><h2 id="limits-title">What this app does not do</h2><p>It does not host your files, hold money, collect payment, or provide legal advice. Export records you need to keep.</p><a href="/privacy/">Read the privacy policy</a></section>
  </main>`);
  setRoute(state.isDemo ? 'Demo — Delivery Receipt' : 'Delivery Receipt — record delivered work', 'Record freelance deliveries, collect a client response, and export a receipt from your browser.', state.isDemo ? '/demo' : '/', state.isDemo ? 'Sample receipt opened.' : 'Delivery Receipt opened.');
  bindHome();
}

function captureDraft(): void {
  const form = app.querySelector<HTMLFormElement>('[data-receipt-form]');
  if (!form) return;
  const data = new FormData(form);
  for (const key of ['project', 'freelancer', 'client', 'deliveryDate', 'dueDate', 'note', 'service']) state.draft[key] = String(data.get(key) ?? '');
}

async function createReceipt(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  captureDraft();
  const form = event.currentTarget as HTMLFormElement;
  for (const field of requiredReceiptText) {
    const input = form.elements.namedItem(field.name);
    if (!(input instanceof HTMLInputElement) || state.draft[field.name].trim()) continue;
    input.setCustomValidity(`${field.label} cannot contain only spaces.`);
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return setNotice(`${field.label} cannot be blank. Enter a value before sealing.`, true);
  }
  const firstInvalid = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(':invalid');
  if (firstInvalid) {
    firstInvalid.focus();
    return setNotice('Complete the required delivery details before sealing.', true);
  }
  if (!state.deliverables.length) {
    app.querySelector('.tracks')?.scrollIntoView({ behavior: 'smooth' });
    return setNotice('Add at least one file fingerprint or completed service.', true);
  }
  const record: ReceiptRecord = {
    version: 1, id: randomId(), project: state.draft.project.trim(), freelancer: state.draft.freelancer.trim(), client: state.draft.client.trim(), deliveryDate: state.draft.deliveryDate,
    ...(state.draft.dueDate ? { dueDate: state.draft.dueDate } : {}), ...(state.draft.note.trim() ? { note: state.draft.note.trim() } : {}),
    deliverables: state.deliverables.map((item) => ({ ...item })), manifestHash: manifestHash(state.deliverables), createdAt: new Date().toISOString(), status: 'draft'
  };
  if (!verifyReceipt(publicPart(record))) return setNotice('This delivery could not be verified. Review the details and try again.', true);
  await saveReceipt(record);
  state.current = record;
  state.records = await getReceipts();
  renderHome();
  app.querySelector('.sealed-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setNotice('Delivery sealed. The manifest hash is now fixed.');
}

async function importArchive(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const bundle: unknown = JSON.parse(await file.text());
    await importBundle(bundle);
    state.records = await getReceipts();
    state.current = state.records[0] ?? state.current;
    renderHome();
    setNotice(`${state.records.length} receipt${state.records.length === 1 ? '' : 's'} available after import.`);
  } catch (error) {
    setNotice(error instanceof Error ? error.message : 'That archive could not be imported. No local records were changed.', true);
  } finally {
    input.value = '';
  }
}

function bindReceiptActions(): void {
  const record = state.current;
  if (!record) return;
  const receipt = publicPart(record);
  const url = acknowledgementUrl(receipt);
  const markSent = async (): Promise<void> => {
    if (record.status !== 'draft') return;
    record.status = 'sent';
    await saveReceipt(record);
    state.records = await getReceipts();
  };
  app.querySelector('[data-copy-link]')?.addEventListener('click', async () => { await copyText(url, 'Acknowledgement link copied. Send it with the delivery.'); await markSent(); });
  app.querySelector('[data-share-link]')?.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Delivery receipt: ${record.project}`, text: `${record.freelancer} sent a delivery manifest for ${record.project}.`, url }); } catch { return; }
    } else await copyText(url, 'Acknowledgement link copied.');
    await markSent();
  });
  app.querySelector('[data-download-pdf]')?.addEventListener('click', () => { downloadBytes(receiptPdf(receipt, record.response), `${record.id}.pdf`, 'application/pdf'); setNotice('Receipt PDF downloaded.'); });
  app.querySelector('[data-download-record]')?.addEventListener('click', () => { downloadBytes(new TextEncoder().encode(JSON.stringify(record, null, 2)), `${record.id}.json`, 'application/json'); setNotice('Receipt JSON downloaded.'); });
  app.querySelector<HTMLFormElement>('[data-response-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget as HTMLFormElement).get('responseCode') ?? '').trim();
    try {
      const response = decodePortable<ClientResponse>(code);
      if (!verifyResponse(response) || response.receiptId !== record.id || response.manifestHash !== record.manifestHash) throw new Error('response mismatch');
      record.response = response;
      record.status = response.decision;
      await Promise.all([saveReceipt(record), saveResponse(response)]);
      state.records = await getReceipts();
      renderHome();
      setNotice(`Verified: the client ${response.decision} this exact manifest.`);
    } catch {
      setNotice('That response code is invalid or belongs to a different manifest. Ask the client to copy it again.', true);
    }
  });
}

function bindHome(): void {
  app.querySelector<HTMLFormElement>('[data-receipt-form]')?.addEventListener('input', (event) => {
    captureDraft();
    const input = event.target;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); }
  });
  app.querySelector<HTMLInputElement>('#file-input')?.addEventListener('change', async (event) => {
    captureDraft();
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const sha256 = await hashFile(file, (percent) => {
          state.hashing = `Reading ${file.name} — ${percent}% (${index + 1}/${files.length})`;
          const progress = app.querySelector('.hash-progress');
          if (progress) progress.textContent = state.hashing;
        });
        state.deliverables.push({ id: crypto.randomUUID(), kind: 'file', name: file.name, size: file.size, lastModified: file.lastModified, sha256 });
      }
      state.hashing = '';
      renderHome();
      setNotice(`${files.length} file${files.length === 1 ? '' : 's'} fingerprinted. File contents were not saved.`);
    } catch {
      state.hashing = '';
      setNotice('A file could not be read. Check its permissions and select it again.', true);
    }
  });
  app.querySelector('[data-add-service]')?.addEventListener('click', () => {
    captureDraft();
    const name = state.draft.service.trim();
    if (!name) return setNotice('Name the completed service before adding it.', true);
    state.deliverables.push({ id: crypto.randomUUID(), kind: 'service', name });
    state.draft.service = '';
    renderHome();
    app.querySelector<HTMLInputElement>('#service-item')?.focus();
    setNotice('Service added to the delivery items.');
  });
  app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => button.addEventListener('click', () => {
    captureDraft();
    state.deliverables = state.deliverables.filter((item) => item.id !== button.dataset.remove);
    renderHome();
    setNotice('Item removed from the delivery items.');
  }));
  app.querySelector<HTMLFormElement>('[data-receipt-form]')?.addEventListener('submit', createReceipt);
  bindReceiptActions();
  app.querySelectorAll<HTMLButtonElement>('[data-open-record]').forEach((button) => button.addEventListener('click', () => {
    const record = state.records.find((item) => item.id === button.dataset.openRecord);
    if (!record) return;
    state.current = record;
    renderHome();
    app.querySelector('.sealed-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-delete-record]').forEach((button) => button.addEventListener('click', async () => {
    const record = state.records.find((item) => item.id === button.dataset.deleteRecord);
    if (!record || !confirm(`Delete the receipt for ${record.project}? This cannot be undone.`)) return;
    await deleteReceipt(record.id);
    if (state.current?.id === record.id) state.current = undefined;
    state.records = await getReceipts();
    renderHome();
    setNotice('Receipt deleted from this device.');
  }));
  app.querySelector('[data-export-all]')?.addEventListener('click', async () => {
    const bundle = await exportBundle();
    downloadBytes(new TextEncoder().encode(JSON.stringify(bundle, null, 2)), `delivery-receipts-${today}.json`, 'application/json');
    setNotice('Archive exported. Keep the JSON somewhere you control.');
  });
  app.querySelector<HTMLInputElement>('#import-all')?.addEventListener('change', importArchive);
  app.querySelector('[data-reset-demo]')?.addEventListener('click', async () => {
    await resetDemoData();
    state.records = await getReceipts();
    state.current = state.records[0];
    state.deliverables = [];
    renderHome();
    setNotice('Sample data reset. Your real records were not changed.');
  });
}

function acknowledgementForm(receipt: PublicReceipt): string {
  return `<form class="ack-form" data-ack-form><div class="tape-label"><span>Your response</span><span>Required fields *</span></div><fieldset><legend>Does this receipt match what you received?</legend><div class="decision-grid"><label><input type="radio" name="decision" value="accepted" required><span><strong>Accept delivery record</strong><small>The list matches the handoff I received.</small></span></label><label><input type="radio" name="decision" value="declined" required><span><strong>Decline delivery record</strong><small>Something is missing, different, or not received.</small></span></label></div></fieldset><div class="field"><label for="client-name">Your name <span aria-hidden="true">*</span></label><input id="client-name" name="clientName" required maxlength="100" autocomplete="name"></div><div class="field"><label for="client-note">Response note <span class="optional">optional</span></label><textarea id="client-note" name="note" rows="4" maxlength="800"></textarea><p class="field-hint">If declining, name what is missing or different. Do not include confidential data.</p></div><label class="check-row"><input type="checkbox" name="confirmed" required><span>I reviewed receipt ${e(receipt.id)} and the manifest hash shown above.</span></label><button class="button button-primary button-big" type="submit">Record my response</button><p class="field-hint">This response is saved in this browser. Copy or download it to send it to the freelancer.</p></form>`;
}

function acknowledgementResult(receipt: PublicReceipt, response: ClientResponse): string {
  const code = encodePortable(response);
  return `<section class="ack-result" aria-labelledby="answer-title"><span class="section-kicker">Response recorded</span><h2 id="answer-title">Send this response to the freelancer</h2>${responseSummary(response)}<p>The code carries your decision, name, UTC time, and hashes for this exact receipt. It contains no files.</p><label for="client-response-code">Response code</label><textarea id="client-response-code" rows="4" readonly spellcheck="false">${e(code)}</textarea><div class="action-row"><button class="button button-primary" type="button" data-copy-response>Copy response code</button><button class="button" type="button" data-response-pdf>Download response PDF</button><button class="button button-quiet" type="button" data-response-json>Download response JSON</button></div><p class="field-hint">Return the response code to ${e(receipt.freelancer)} through your usual email or message. Keep the files for your own records.</p></section>`;
}

function renderAcknowledgement(receipt?: PublicReceipt, invalid = false): void {
  if (!receipt || invalid) {
    app.innerHTML = shell('<main id="main" class="ack-main"><section class="bad-link"><span class="section-kicker">Acknowledgement link</span><h1>This acknowledgement link is damaged</h1><p>The manifest could not be verified. Ask the sender to copy a fresh acknowledgement link. Do not respond to an altered record.</p><a class="button" href="/">Open Delivery Receipt</a></section></main>');
    setRoute('Acknowledgement link — Delivery Receipt', 'This acknowledgement link could not be verified.', '/', 'Damaged acknowledgement link.', true);
    bindHome();
    return;
  }
  const response = state.ackResponse;
  app.innerHTML = shell(`<main id="main" class="ack-main"><section class="ack-hero"><div><p class="eyebrow">Client acknowledgement</p><h1>${response ? 'Your response is recorded' : 'Review this delivery receipt'}</h1><p class="lede">${e(receipt.freelancer)} says the following was delivered for <strong>${e(receipt.project)}</strong>. Check it against what you received, then accept or decline the record.</p></div><span class="status-stamp ${response ? `status-${e(response.decision)}` : ''}">${response ? e(response.decision) : 'awaiting'}</span></section><section class="ack-sheet" aria-labelledby="manifest-title"><div class="tape-label"><span>Delivered items</span><span>${e(receipt.id)}</span></div><dl class="receipt-facts"><div><dt>From</dt><dd>${e(receipt.freelancer)}</dd></div><div><dt>For</dt><dd>${e(receipt.client)}</dd></div><div><dt>Delivery date</dt><dd>${e(receipt.deliveryDate)}</dd></div>${receipt.dueDate ? `<div><dt>Invoice due</dt><dd>${e(receipt.dueDate)}</dd></div>` : ''}</dl><h2 id="manifest-title">Delivery items</h2>${deliverableRows(receipt.deliverables)}${receipt.note ? `<div class="handoff-note"><strong>Sender’s note</strong><p>${e(receipt.note)}</p></div>` : ''}<div class="hash-block"><span>Manifest SHA-256</span><code>${e(receipt.manifestHash)}</code><small>Verified in this browser from the delivery items above.</small></div></section>${response ? acknowledgementResult(receipt, response) : acknowledgementForm(receipt)}<aside class="evidence-note client-notice"><strong>What this means.</strong> Your response records whether this list matches the handoff you received. It does not change payment terms, waive rights, or replace the contract. Legal effect depends on the agreement and jurisdiction.</aside></main>`);
  setRoute('Client acknowledgement — Delivery Receipt', 'Review a delivery receipt and record whether it matches the handoff.', location.pathname, 'Client acknowledgement opened.', true);
  if (!response) bindAcknowledgement(receipt); else bindAcknowledgementResult(receipt, response);
  bindHome();
}

function bindAcknowledgement(receipt: PublicReceipt): void {
  const form = app.querySelector<HTMLFormElement>('[data-ack-form]');
  form?.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); }
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const clientName = String(data.get('clientName') ?? '').trim();
    if (!clientName) {
      const input = form.elements.namedItem('clientName');
      if (input instanceof HTMLInputElement) { input.setCustomValidity('Your name cannot contain only spaces.'); input.setAttribute('aria-invalid', 'true'); input.focus(); input.reportValidity(); }
      return setNotice('Your name cannot be blank. Enter a name before recording the response.', true);
    }
    const body: Omit<ClientResponse, 'responseHash'> = { version: 1, receiptId: receipt.id, manifestHash: receipt.manifestHash, decision: String(data.get('decision')) as ClientResponse['decision'], clientName, ...(String(data.get('note') ?? '').trim() ? { note: String(data.get('note')).trim() } : {}), respondedAt: new Date().toISOString() };
    const response = { ...body, responseHash: makeResponseHash(body) };
    await saveResponse(response);
    state.ackResponse = response;
    renderAcknowledgement(receipt);
    app.querySelector('.ack-result')?.scrollIntoView({ behavior: 'smooth' });
    setNotice(`Response recorded as ${response.decision}. Send it to the freelancer.`);
  });
}

function bindAcknowledgementResult(receipt: PublicReceipt, response: ClientResponse): void {
  const code = encodePortable(response);
  app.querySelector('[data-copy-response]')?.addEventListener('click', () => copyText(code, 'Response code copied. Send it to the freelancer.'));
  app.querySelector('[data-response-pdf]')?.addEventListener('click', () => { downloadBytes(receiptPdf(receipt, response), `${receipt.id}-${response.decision}.pdf`, 'application/pdf'); setNotice('Response PDF downloaded.'); });
  app.querySelector('[data-response-json]')?.addEventListener('click', () => { downloadBytes(new TextEncoder().encode(JSON.stringify(response, null, 2)), `${receipt.id}-response.json`, 'application/json'); setNotice('Response JSON downloaded.'); });
}

function renderLegal(kind: 'privacy' | 'terms'): void {
  const privacy = `<main id="main" class="legal-main"><article><span class="section-kicker">Privacy policy · 2026-09-05</span><h1>Privacy for local delivery records</h1><p class="lede">Delivery Receipt keeps the core receipt tools in your browser.</p><h2>What stays on your device</h2><p>Receipt details, file metadata and hashes, and client response records are stored in this browser. Selected file bytes are read only to calculate a SHA-256 fingerprint. This app does not upload or retain the file contents.</p><h2>What a shared link contains</h2><p>An acknowledgement link contains names, project details, dates, notes, file names, file sizes, modification dates, hashes, service items, receipt ID, and the manifest hash. Anyone with the link can read those details. Do not include secrets.</p><h2>Network requests</h2><p>The core app has no analytics, advertising, account system, or sync service. It does not send your delivery data to another service.</p><h2>Your controls</h2><p>You can export records as JSON, import a valid archive on another device, or delete a receipt. Clearing this site’s browser storage removes local records. We cannot recover them because we do not receive a copy.</p><h2>Contact</h2><p>Privacy questions: <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>.</p></article></main>`;
  const terms = `<main id="main" class="legal-main"><article><span class="section-kicker">Terms · 2026-09-05</span><h1>Terms for delivery records</h1><p class="lede">Use Delivery Receipt to document a handoff, not to control payment or access to work.</p><h2>What the product does</h2><p>The app creates a local delivery list, hashes selected files, creates an acknowledgement page, records a client response, and exports PDF and JSON records.</p><h2>Evidence only</h2><p>A receipt records entered data and a stated response. It is not legal advice, an identity check, a digital-signature service, escrow, collections, or a guarantee of legal effect. Legal effect depends on the contract, facts, and jurisdiction.</p><h2>Your responsibilities</h2><p>Enter accurate information, protect links that contain confidential metadata, deliver work through a suitable channel, and keep the exports you need.</p><h2>Availability</h2><p>The software is provided as is to the extent allowed by law. You are responsible for exporting records you need to retain.</p><h2>Contact</h2><p>Terms questions: <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p></article></main>`;
  app.innerHTML = shell(kind === 'privacy' ? privacy : terms);
  setRoute(kind === 'privacy' ? 'Privacy — Delivery Receipt' : 'Terms — Delivery Receipt', kind === 'privacy' ? 'Read how Delivery Receipt stores local delivery records and shared-link details.' : 'Read the terms for using Delivery Receipt as a local delivery record.', kind === 'privacy' ? '/privacy/' : '/terms/', `${kind === 'privacy' ? 'Privacy policy' : 'Terms'} opened.`);
  bindHome();
}

function renderUnknown(): void {
  app.innerHTML = shell('<main id="main" class="ack-main"><section class="bad-link"><span class="section-kicker">Page not found</span><h1>This page is not available</h1><p>Use the home page to create a receipt or open the sample.</p><a class="button button-primary" href="/">Open Delivery Receipt</a></section></main>');
  setRoute('Page not found — Delivery Receipt', 'The requested Delivery Receipt page was not found.', '/', 'Page not found.', true);
  bindHome();
}

function renderStorageError(): void {
  app.innerHTML = shell('<main id="main" class="ack-main"><section class="bad-link"><h1>Local storage could not open</h1><p>Your browser may be blocking site data. Allow site data, then reload this page.</p><button class="button" type="button" data-retry>Reload page</button></section></main>');
  app.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
  setRoute('Storage error — Delivery Receipt', 'Delivery Receipt could not open browser storage.', '/', 'Local storage could not open.', true);
}

async function initialize(): Promise<void> {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const demoAcknowledgement = path.startsWith('/ack/demo/');
  state.isDemo = path === '/demo' || demoAcknowledgement;
  setStorageMode(state.isDemo ? 'demo' : 'real');
  if (path === '/privacy') return renderLegal('privacy');
  if (path === '/terms') return renderLegal('terms');
  if (path.startsWith('/ack/')) {
    const encoded = demoAcknowledgement ? path.slice('/ack/demo/'.length) : path.slice('/ack/'.length);
    try {
      const receipt = decodePortable<PublicReceipt>(encoded);
      if (!verifyReceipt(receipt)) throw new Error('manifest mismatch');
      state.ackResponse = (await getResponses()).find((response) => response.receiptId === receipt.id && response.manifestHash === receipt.manifestHash);
      renderAcknowledgement(receipt);
    } catch {
      renderAcknowledgement(undefined, true);
    }
    return;
  }
  if (path === '/demo') await ensureDemoData();
  else if (path !== '/') return renderUnknown();
  state.records = await getReceipts();
  state.current = state.records[0];
  renderHome();
}

window.addEventListener('online', () => { captureDraft(); void initialize().then(() => setNotice('Back online. Local work stayed on this device.')); });
window.addEventListener('offline', () => { captureDraft(); void initialize().then(() => setNotice('Offline. Core receipt tools still work.')); });
window.addEventListener('popstate', () => { void initialize(); });

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => setNotice('Offline setup could not finish. The app still works while connected.', true));
  });
  navigator.serviceWorker.addEventListener('message', (event) => { if (event.data?.type === 'UPDATE_READY') setNotice('An update is ready. Reload when convenient.'); });
}

void initialize().catch(renderStorageError);
