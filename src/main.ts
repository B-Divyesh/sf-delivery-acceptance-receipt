import './style.css';
import { decodePortable, encodePortable, hashFile, makeResponseHash, manifestHash, verifyReceipt, verifyResponse } from './crypto';
import { deleteReceipt, exportBundle, getReceipt, getReceipts, getResponses, importBundle, saveReceipt, saveResponse } from './db';
import { buyUrl, cachedLicense, captureReturnedLicense, isPremium, restoreLicense, verifyLicense } from './license';
import { downloadBytes, receiptPdf } from './pdf';
import type { ClientResponse, Deliverable, ExportBundle, PublicReceipt, ReceiptRecord } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root is missing');

const today = new Date().toISOString().slice(0, 10);
const state: {
  deliverables: Deliverable[];
  records: ReceiptRecord[];
  current?: ReceiptRecord;
  ackReceipt?: PublicReceipt;
  ackResponse?: ClientResponse;
  message: string;
  error: string;
  hashing: string;
  draft: Record<string, string>;
} = {
  deliverables: [], records: [], message: '', error: '', hashing: '',
  draft: { project: '', freelancer: '', client: '', deliveryDate: today, dueDate: '', note: '', service: '', footer: '' }
};

const e = (value: unknown): string => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character] ?? character);

const formatBytes = (bytes = 0): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const shortHash = (hash: string): string => `${hash.slice(0, 12)}…${hash.slice(-12)}`;
const randomId = (): string => `DR-${today.replaceAll('-', '')}-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const requiredReceiptText = [
  { name: 'project', label: 'Project or engagement' },
  { name: 'freelancer', label: 'Your name or studio' },
  { name: 'client', label: 'Client name' }
] as const;
const publicPart = (record: ReceiptRecord): PublicReceipt => {
  const { status: _status, response: _response, ...receipt } = record;
  return receipt;
};
const shareUrl = (receipt: PublicReceipt): string => `${location.origin}/#ack=${encodePortable(receipt)}`;

function shell(content: string, minimal = false): string {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="Delivery Receipt home">
        <svg viewBox="0 0 44 32" aria-hidden="true"><rect x="1.5" y="2" width="41" height="28"/><circle cx="14" cy="15" r="5"/><circle cx="30" cy="15" r="5"/><path d="M12 25h20"/></svg>
        <span>Delivery<br>Receipt</span>
      </a>
      ${minimal ? '<span class="side-label">CLIENT SIDE / B</span>' : `<nav aria-label="Primary"><a href="/#make">Make one</a><a href="/#records">Records</a><a href="/#studio">Studio unlock</a></nav>`}
      <span class="network-status" data-online>${navigator.onLine ? '● Online' : '× Offline'}</span>
    </header>
    ${!navigator.onLine ? '<div class="offline-strip" role="status">Offline deck: hashing, receipts, responses, PDF, and saved records still work. License checks wait for a connection.</div>' : ''}
    ${content}
    <footer>
      <p>Local-first. No files, money, or credentials held.</p>
      <nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="https://delivery-acceptance-receipt.sociobot.in">Product site</a></nav>
      <p class="generated-note">Original generated cassette artwork · © 2026 Sociobot · MIT code</p>
    </footer>
    <div class="toast ${state.error ? 'toast-error' : ''}" role="status" aria-live="polite" aria-atomic="true">${e(state.error || state.message || state.hashing)}</div>`;
}

function deliverableRows(items: Deliverable[], removable = false): string {
  if (!items.length) return '<div class="empty-slot"><span aria-hidden="true">＋</span><p>No tracks yet. Add file fingerprints or a service item.</p></div>';
  return `<ol class="manifest-list">${items.map((item, index) => `
    <li class="manifest-row">
      <span class="track">${String(index + 1).padStart(2, '0')}</span>
      <span class="kind">${item.kind}</span>
      <span class="item-name">${e(item.name)}</span>
      ${item.kind === 'file' ? `<span class="file-meta">${formatBytes(item.size)} · SHA-256 <span title="${e(item.sha256)}">${shortHash(item.sha256 ?? '')}</span></span>` : '<span class="file-meta">Completed service</span>'}
      ${removable ? `<button class="icon-button" type="button" data-remove="${e(item.id)}" aria-label="Remove ${e(item.name)}">×</button>` : ''}
    </li>`).join('')}</ol>`;
}

function receiptPanel(record: ReceiptRecord): string {
  const receipt = publicPart(record);
  const url = shareUrl(receipt);
  const premium = isPremium();
  return `<section class="sealed-sheet" aria-labelledby="sealed-title">
    <div class="section-kicker">02 / Seal it</div>
    <div class="sheet-heading">
      <div><h2 id="sealed-title">Receipt ready to hand over</h2><p>The link contains the manifest, never the file contents.</p></div>
      <span class="status-stamp status-${e(record.status)}">${e(record.status)}</span>
    </div>
    <dl class="receipt-facts">
      <div><dt>Receipt</dt><dd>${e(record.id)}</dd></div>
      <div><dt>Manifest SHA-256</dt><dd class="hash">${e(record.manifestHash)}</dd></div>
      <div><dt>Client</dt><dd>${e(record.client)}</dd></div>
      <div><dt>Delivery</dt><dd>${e(record.deliveryDate)}</dd></div>
    </dl>
    <label for="share-link">Client acknowledgement link</label>
    <div class="copy-row"><input id="share-link" readonly value="${e(url)}"><button class="button button-primary" type="button" data-copy-link>Copy link</button></div>
    <p class="field-hint">Send this link with your actual files. Your client reviews the locked manifest separately and returns a response code.</p>
    <div class="action-row">
      <button class="button" type="button" data-share-link>Share acknowledgement</button>
      <button class="button" type="button" data-download-pdf="${e(record.id)}">Download PDF</button>
      <button class="button button-quiet" type="button" data-download-record="${e(record.id)}">Download JSON</button>
    </div>
    <div class="premium-footer ${premium ? '' : 'is-locked'}">
      <label for="custom-footer">${premium ? 'Studio PDF footer' : 'Custom PDF footer — Studio unlock'}</label>
      <input id="custom-footer" name="footer" maxlength="120" value="${e(state.draft.footer)}" ${premium ? '' : 'disabled'} placeholder="Your studio URL or contract reference">
    </div>
    ${record.response ? responseSummary(record.response) : `
      <form class="response-import" data-response-form>
        <h3>03 / Bring back the answer</h3>
        <p>Paste the response code the client sends you. It is checked against this exact manifest.</p>
        <label for="response-code">Client response code</label>
        <textarea id="response-code" name="responseCode" rows="3" required spellcheck="false"></textarea>
        <button class="button button-primary" type="submit">Verify response</button>
      </form>`}
  </section>`;
}

function responseSummary(response: ClientResponse): string {
  return `<div class="response-summary response-${e(response.decision)}">
    <div><span class="section-kicker">03 / Answer returned</span><h3>${response.decision === 'accepted' ? 'Accepted by' : 'Declined by'} ${e(response.clientName)}</h3><p>${e(response.respondedAt)}${response.note ? ` · “${e(response.note)}”` : ''}</p></div>
    <span class="status-stamp status-${e(response.decision)}">${e(response.decision)}</span>
  </div>`;
}

function recordsMarkup(): string {
  const sorted = [...state.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!sorted.length) return `<div class="records-empty"><p class="empty-title">Your deck is empty.</p><p>Make the first receipt above. It will stay on this device until you export or delete it.</p></div>`;
  return `<div class="record-stack">${sorted.map((record) => `
    <article class="record-card">
      <button type="button" class="record-open" data-open-record="${e(record.id)}">
        <span class="status-dot status-${e(record.status)}" aria-hidden="true"></span>
        <span><strong>${e(record.project)}</strong><small>${e(record.client)} · ${e(record.deliveryDate)}</small></span>
        <span class="record-status">${e(record.status)}</span>
      </button>
      <button class="icon-button" type="button" data-delete-record="${e(record.id)}" aria-label="Delete receipt for ${e(record.project)}">×</button>
    </article>`).join('')}</div>`;
}

function licenseMarkup(): string {
  const license = cachedLicense();
  const premium = isPremium();
  return `<section id="studio" class="studio-section" aria-labelledby="studio-title">
    <div class="sticker">ONE-TIME / ₹499</div>
    <div>
      <span class="section-kicker">Studio unlock</span>
      <h2 id="studio-title">Make the paper yours.</h2>
      <p>The free deck includes unlimited receipts, hashing, responses, data export, and standard PDFs. A one-time ₹499 license adds discreet brand-free PDFs and your custom studio footer on this device.</p>
      <p class="license-status">${premium ? '✓ Studio is unlocked.' : license?.reason && !license.valid ? `License no longer active (${e(license.reason)}).` : 'Free deck active.'}</p>
      <div class="action-row"><a class="button button-primary" href="${buyUrl}">Buy Studio once</a></div>
      <details><summary>Have a license? Restore it</summary>
        <form data-license-form><label for="license-token">License token</label><div class="copy-row"><input id="license-token" name="license" required autocomplete="off" spellcheck="false"><button class="button" type="submit" aria-label="Verify license">Verify license</button></div></form>
      </details>
      <p class="fine-print">Checkout is hosted by Sociobot; Dodo is merchant of record. Refunds are handled there and revoke the license. <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p>
    </div>
  </section>`;
}

function renderHome(): void {
  app.innerHTML = shell(`<main id="main">
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy"><p class="eyebrow">THE HANDOFF TAPE / LOCAL-FIRST</p><h1 id="page-title">Deliver the work.<br><mark>Keep the record.</mark></h1><p class="lede">Hash the files or list the services. Give your client a clean acknowledgement page. Leave with a portable receipt—not another awkward email thread.</p><a class="button button-primary button-big" href="#make">Make a receipt <span aria-hidden="true">↓</span></a><p class="trust-line"><span>Files stay here</span><span>No account</span><span>Works offline</span></p></div>
      <figure class="hero-art"><picture><source media="(max-width: 700px)" srcset="/assets/hero-cassette-720.avif" type="image/avif"><source srcset="/assets/hero-cassette-1200.avif" type="image/avif"><source media="(max-width: 700px)" srcset="/assets/hero-cassette-720.webp" type="image/webp"><source srcset="/assets/hero-cassette-1200.webp" type="image/webp"><img src="/assets/hero-cassette.jpg" width="1200" height="800" fetchpriority="high" alt="A transparent cassette on a cream paper collage, relabelled as a checklist with blue acceptance stamps"></picture><figcaption>SIDE A: what left your desk.</figcaption></figure>
    </section>

    <section id="make" class="maker" aria-labelledby="make-title">
      <div class="maker-intro"><span class="section-kicker">01 / Log it</span><h2 id="make-title">What did you hand over?</h2><p>Select files to fingerprint them in this browser, or list a completed service. File contents are never stored or put in the link.</p></div>
      <form class="receipt-form" data-receipt-form novalidate>
        <div class="form-grid">
          <div class="field field-wide"><label for="project">Project or engagement <span aria-hidden="true">*</span></label><input id="project" name="project" required maxlength="100" value="${e(state.draft.project)}" autocomplete="off"><p class="field-hint">Example: Brand launch files</p></div>
          <div class="field"><label for="freelancer">Your name or studio <span aria-hidden="true">*</span></label><input id="freelancer" name="freelancer" required maxlength="100" value="${e(state.draft.freelancer)}" autocomplete="organization"></div>
          <div class="field"><label for="client">Client name <span aria-hidden="true">*</span></label><input id="client" name="client" required maxlength="100" value="${e(state.draft.client)}" autocomplete="organization"></div>
          <div class="field"><label for="delivery-date">Delivery date <span aria-hidden="true">*</span></label><input id="delivery-date" name="deliveryDate" required type="date" value="${e(state.draft.deliveryDate)}"></div>
          <div class="field"><label for="due-date">Final invoice due <span class="optional">optional</span></label><input id="due-date" name="dueDate" type="date" value="${e(state.draft.dueDate)}"></div>
        </div>
        <fieldset class="tracks"><legend>Delivery manifest <span aria-hidden="true">*</span></legend>
          <div class="track-actions"><label class="button file-button" for="file-input">＋ Fingerprint files</label><input class="visually-hidden" id="file-input" type="file" multiple><span class="or">or</span><div class="service-add"><label class="visually-hidden" for="service-item">Completed service</label><input id="service-item" name="service" maxlength="120" value="${e(state.draft.service)}" placeholder="e.g. Final strategy workshop"><button class="button" type="button" data-add-service>Add service</button></div></div>
          <div class="hash-progress" aria-live="polite">${e(state.hashing)}</div>
          ${deliverableRows(state.deliverables, true)}
        </fieldset>
        <div class="field"><label for="note">Handoff note <span class="optional">optional</span></label><textarea id="note" name="note" maxlength="800" rows="4">${e(state.draft.note)}</textarea><p class="field-hint">Mention the delivery channel, agreed revision round, or contract reference. Don’t include secrets.</p></div>
        <p class="evidence-note"><strong>Evidence, not enforcement.</strong> This receipt does not hold work, collect money, or replace your contract. Legal effect depends on your jurisdiction and agreement.</p>
        <button class="button button-primary button-big" type="submit">Seal this delivery</button>
      </form>
    </section>
    ${state.current ? receiptPanel(state.current) : ''}
    <section id="records" class="records-section" aria-labelledby="records-title"><div class="section-heading"><div><span class="section-kicker">Local archive</span><h2 id="records-title">Receipts on this device</h2></div><div class="action-row"><button class="button button-quiet" type="button" data-export-all>Export all JSON</button><label class="button button-quiet" for="import-all">Import JSON</label><input class="visually-hidden" id="import-all" type="file" accept="application/json"></div></div>${recordsMarkup()}</section>
    ${licenseMarkup()}
    <section class="how-section" aria-labelledby="how-title"><div><span class="section-kicker">Fair by design</span><h2 id="how-title">Proof without a hostage situation.</h2></div><ol><li><strong>Hash locally.</strong><span>A fingerprint proves the selected bytes without uploading them.</span></li><li><strong>Send normally.</strong><span>Use your usual drive or email. This app never stands between the client and the work.</span></li><li><strong>Record the answer.</strong><span>Acceptance or decline carries the manifest hash, name, UTC time, and response hash.</span></li></ol></section>
  </main>`);
  bindHome();
}

function captureDraft(): void {
  const form = document.querySelector<HTMLFormElement>('[data-receipt-form]');
  if (!form) return;
  const data = new FormData(form);
  for (const key of ['project', 'freelancer', 'client', 'deliveryDate', 'dueDate', 'note', 'service']) state.draft[key] = String(data.get(key) ?? '');
  const footer = document.querySelector<HTMLInputElement>('#custom-footer');
  if (footer) state.draft.footer = footer.value;
}

function setNotice(message: string, error = false): void {
  state.message = error ? '' : message;
  state.error = error ? message : '';
  const toast = document.querySelector<HTMLDivElement>('.toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.toggle('toast-error', error);
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 5000);
  }
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

function bindHome(): void {
  document.querySelector<HTMLFormElement>('[data-receipt-form]')?.addEventListener('input', (event) => {
    captureDraft();
    const input = event.target;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
    }
  });
  document.querySelector<HTMLInputElement>('#file-input')?.addEventListener('change', async (event) => {
    captureDraft();
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const digest = await hashFile(file, (percent) => {
          state.hashing = `Reading ${e(file.name)} — ${percent}% (${index + 1}/${files.length})`;
          const progress = document.querySelector('.hash-progress');
          if (progress) progress.textContent = state.hashing;
        });
        state.deliverables.push({ id: crypto.randomUUID(), kind: 'file', name: file.name, size: file.size, lastModified: file.lastModified, sha256: digest });
      }
      state.hashing = '';
      renderHome();
      setNotice(`${files.length} file${files.length === 1 ? '' : 's'} fingerprinted. File contents were not saved.`);
    } catch {
      state.hashing = '';
      setNotice('A file could not be read. Check its permissions and try selecting it again.', true);
    }
  });
  document.querySelector('[data-add-service]')?.addEventListener('click', () => {
    captureDraft();
    const name = state.draft.service.trim();
    if (!name) return setNotice('Name the completed service before adding it.', true);
    state.deliverables.push({ id: crypto.randomUUID(), kind: 'service', name });
    state.draft.service = '';
    renderHome();
    document.querySelector<HTMLInputElement>('#service-item')?.focus();
    setNotice('Service added to the manifest.');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => button.addEventListener('click', () => {
    captureDraft();
    state.deliverables = state.deliverables.filter((item) => item.id !== button.dataset.remove);
    renderHome();
    setNotice('Item removed from the manifest.');
  }));
  document.querySelector<HTMLFormElement>('[data-receipt-form]')?.addEventListener('submit', createReceipt);
  bindReceiptActions();
  document.querySelectorAll<HTMLButtonElement>('[data-open-record]').forEach((button) => button.addEventListener('click', async () => {
    const record = await getReceipt(button.dataset.openRecord ?? '');
    if (!record) return setNotice('That local receipt could not be found.', true);
    captureDraft();
    state.current = record;
    renderHome();
    document.querySelector('.sealed-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete-record]').forEach((button) => button.addEventListener('click', async () => {
    const record = state.records.find((item) => item.id === button.dataset.deleteRecord);
    if (!record || !confirm(`Delete “${record.project}” from this device? Export it first if you may need it. This cannot be undone.`)) return;
    await deleteReceipt(record.id);
    if (state.current?.id === record.id) state.current = undefined;
    state.records = await getReceipts();
    renderHome();
    setNotice('Local receipt deleted.');
  }));
  document.querySelector('[data-export-all]')?.addEventListener('click', async () => {
    const bundle = await exportBundle();
    downloadBytes(new TextEncoder().encode(JSON.stringify(bundle, null, 2)), `delivery-receipts-${today}.json`, 'application/json');
    setNotice('Archive exported. Keep the JSON somewhere you control.');
  });
  document.querySelector<HTMLInputElement>('#import-all')?.addEventListener('change', importArchive);
  document.querySelector<HTMLFormElement>('[data-license-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const token = String(new FormData(form).get('license') ?? '').trim();
    if (!token) return;
    restoreLicense(token);
    setNotice(navigator.onLine ? 'Checking the license…' : 'License saved. It will be checked when you are online.');
    const result = await verifyLicense(true);
    renderHome();
    setNotice(result?.valid ? 'Studio unlocked on this device.' : 'That license could not be verified. Check the token and connection.', !result?.valid);
  });
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
    document.querySelector('.tracks')?.scrollIntoView({ behavior: 'smooth' });
    return setNotice('Add at least one file fingerprint or completed service.', true);
  }
  const createdAt = new Date().toISOString();
  const deliverables = state.deliverables.map((item) => ({ ...item }));
  const record: ReceiptRecord = {
    version: 1, id: randomId(), project: state.draft.project.trim(), freelancer: state.draft.freelancer.trim(), client: state.draft.client.trim(),
    deliveryDate: state.draft.deliveryDate, ...(state.draft.dueDate ? { dueDate: state.draft.dueDate } : {}),
    ...(state.draft.note.trim() ? { note: state.draft.note.trim() } : {}), deliverables, manifestHash: manifestHash(deliverables), createdAt, status: 'draft'
  };
  if (!verifyReceipt(publicPart(record))) {
    return setNotice('This delivery could not be verified, so it was not sealed. Review the details and try again.', true);
  }
  await saveReceipt(record);
  state.current = record;
  state.records = await getReceipts();
  renderHome();
  document.querySelector('.sealed-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setNotice('Delivery sealed. The manifest hash is now fixed.');
}

function bindReceiptActions(): void {
  const record = state.current;
  if (!record) return;
  const publicReceipt = publicPart(record);
  const url = shareUrl(publicReceipt);
  document.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
    await copyText(url, 'Acknowledgement link copied. Send it with the actual delivery.');
    if (record.status === 'draft') { record.status = 'sent'; await saveReceipt(record); state.records = await getReceipts(); }
  });
  document.querySelector('[data-share-link]')?.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Delivery receipt: ${record.project}`, text: `${record.freelancer} sent a delivery manifest for ${record.project}. Review and respond:`, url }); }
      catch { return; }
    } else await copyText(url, 'Acknowledgement link copied.');
    if (record.status === 'draft') { record.status = 'sent'; await saveReceipt(record); state.records = await getReceipts(); }
  });
  document.querySelector('[data-download-pdf]')?.addEventListener('click', () => {
    captureDraft();
    const footer = isPremium() ? state.draft.footer.trim() : '';
    downloadBytes(receiptPdf(publicReceipt, record.response, footer, isPremium()), `${record.id}.pdf`, 'application/pdf');
    setNotice('Receipt PDF downloaded.');
  });
  document.querySelector('[data-download-record]')?.addEventListener('click', () => {
    downloadBytes(new TextEncoder().encode(JSON.stringify(record, null, 2)), `${record.id}.json`, 'application/json');
    setNotice('Portable receipt JSON downloaded.');
  });
  document.querySelector<HTMLFormElement>('[data-response-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const code = String(new FormData(form).get('responseCode') ?? '').trim();
    try {
      const response = decodePortable<ClientResponse>(code);
      if (!verifyResponse(response)) throw new Error('bad response');
      if (response.receiptId !== record.id || response.manifestHash !== record.manifestHash) throw new Error('wrong receipt');
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

async function importArchive(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const bundle = JSON.parse(await file.text()) as ExportBundle;
    await importBundle(bundle);
    state.records = await getReceipts();
    renderHome();
    setNotice(`${bundle.receipts.length} receipt${bundle.receipts.length === 1 ? '' : 's'} imported.`);
  } catch (error) {
    setNotice(error instanceof Error ? error.message : 'That archive could not be imported.', true);
  }
}

function renderAcknowledgement(receipt?: PublicReceipt, invalid = false): void {
  if (!receipt || invalid) {
    app.innerHTML = shell(`<main id="main" class="ack-main"><section class="bad-link"><span class="section-kicker">CLIENT SIDE / B</span><h1>This handoff link is damaged.</h1><p>The manifest could not be verified. Ask the sender to copy a fresh acknowledgement link; do not respond to an altered record.</p><a class="button" href="/">Open Delivery Receipt</a></section></main>`, true);
    return;
  }
  const response = state.ackResponse;
  app.innerHTML = shell(`<main id="main" class="ack-main">
    <section class="ack-hero"><div><p class="eyebrow">CLIENT ACKNOWLEDGEMENT / LOCKED MANIFEST</p><h1>${response ? 'Your answer is recorded.' : 'Review the handoff.'}</h1><p class="lede">${e(receipt.freelancer)} says the following was delivered for <strong>${e(receipt.project)}</strong>. Check it against what you received, then accept or decline the delivery record.</p></div><span class="status-stamp ${response ? `status-${e(response.decision)}` : ''}">${response ? e(response.decision) : 'awaiting'}</span></section>
    <section class="ack-sheet" aria-labelledby="manifest-title">
      <div class="tape-label"><span>SIDE A / DELIVERY</span><span>${e(receipt.id)}</span></div>
      <dl class="receipt-facts"><div><dt>From</dt><dd>${e(receipt.freelancer)}</dd></div><div><dt>For</dt><dd>${e(receipt.client)}</dd></div><div><dt>Delivery date</dt><dd>${e(receipt.deliveryDate)}</dd></div>${receipt.dueDate ? `<div><dt>Invoice due</dt><dd>${e(receipt.dueDate)}</dd></div>` : ''}</dl>
      <h2 id="manifest-title">Delivered manifest</h2>${deliverableRows(receipt.deliverables)}
      ${receipt.note ? `<div class="handoff-note"><strong>Sender’s note</strong><p>${e(receipt.note)}</p></div>` : ''}
      <div class="hash-block"><span>MANIFEST SHA-256</span><code>${e(receipt.manifestHash)}</code><small>Verified in this browser from the manifest above.</small></div>
    </section>
    ${response ? acknowledgementResult(receipt, response) : acknowledgementForm(receipt)}
    <aside class="evidence-note client-notice"><strong>What this means.</strong> Your answer records whether this manifest matches the handoff you received. It does not change payment terms, waive rights, or replace the underlying contract. Legal effect depends on the contract and jurisdiction.</aside>
  </main>`, true);
  if (!response) bindAcknowledgement(receipt);
  else bindAcknowledgementResult(receipt, response);
}

function acknowledgementForm(receipt: PublicReceipt): string {
  return `<form class="ack-form" data-ack-form>
    <div class="tape-label"><span>SIDE B / YOUR RESPONSE</span><span>REQUIRED FIELDS *</span></div>
    <fieldset><legend>Does this manifest match what you received?</legend><div class="decision-grid"><label><input type="radio" name="decision" value="accepted" required><span><strong>Accept delivery record</strong><small>The manifest matches the handoff I received.</small></span></label><label><input type="radio" name="decision" value="declined" required><span><strong>Decline delivery record</strong><small>Something is missing, different, or not received.</small></span></label></div></fieldset>
    <div class="field"><label for="client-name">Your name <span aria-hidden="true">*</span></label><input id="client-name" name="clientName" required maxlength="100" autocomplete="name"></div>
    <div class="field"><label for="client-note">Response note <span class="optional">optional</span></label><textarea id="client-note" name="note" rows="4" maxlength="800"></textarea><p class="field-hint">If declining, say what is missing or different. Do not include confidential data.</p></div>
    <label class="check-row"><input type="checkbox" name="confirmed" required><span>I reviewed receipt ${e(receipt.id)} and the manifest hash shown above.</span></label>
    <button class="button button-primary button-big" type="submit">Record my response</button>
    <p class="field-hint">Saved only on this device. You’ll download or copy a response for the sender.</p>
  </form>`;
}

function acknowledgementResult(receipt: PublicReceipt, response: ClientResponse): string {
  const code = encodePortable(response);
  return `<section class="ack-result" aria-labelledby="answer-title"><span class="section-kicker">SIDE B / COMPLETE</span><h2 id="answer-title">Send this answer back.</h2>${responseSummary(response)}<p>The code carries your decision, name, UTC time, and hashes for this exact manifest. It contains no files.</p><label for="client-response-code">Response code</label><textarea id="client-response-code" rows="4" readonly spellcheck="false">${e(code)}</textarea><div class="action-row"><button class="button button-primary" type="button" data-copy-response>Copy response code</button><button class="button" type="button" data-response-pdf>Download response PDF</button><button class="button button-quiet" type="button" data-response-json>Download response JSON</button></div><p class="field-hint">Return the response code to ${e(receipt.freelancer)} through your usual email or message thread. Keep the files for your own records.</p></section>`;
}

function bindAcknowledgement(receipt: PublicReceipt): void {
  const acknowledgement = document.querySelector<HTMLFormElement>('[data-ack-form]');
  acknowledgement?.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
    }
  });
  acknowledgement?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const clientName = String(data.get('clientName') ?? '').trim();
    if (!clientName) {
      const input = form.elements.namedItem('clientName');
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity('Your name cannot contain only spaces.');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        input.reportValidity();
      }
      return setNotice('Your name cannot be blank. Enter a name before recording the response.', true);
    }
    const body: Omit<ClientResponse, 'responseHash'> = {
      version: 1, receiptId: receipt.id, manifestHash: receipt.manifestHash,
      decision: String(data.get('decision')) as ClientResponse['decision'], clientName,
      ...(String(data.get('note') ?? '').trim() ? { note: String(data.get('note')).trim() } : {}), respondedAt: new Date().toISOString()
    };
    const response = { ...body, responseHash: makeResponseHash(body) };
    await saveResponse(response);
    state.ackResponse = response;
    renderAcknowledgement(receipt);
    document.querySelector('.ack-result')?.scrollIntoView({ behavior: 'smooth' });
    setNotice(`Response recorded as ${response.decision}. Send it back to the freelancer.`);
  });
}

function bindAcknowledgementResult(receipt: PublicReceipt, response: ClientResponse): void {
  const code = encodePortable(response);
  document.querySelector('[data-copy-response]')?.addEventListener('click', () => copyText(code, 'Response code copied. Send it back to the freelancer.'));
  document.querySelector('[data-response-pdf]')?.addEventListener('click', () => {
    downloadBytes(receiptPdf(receipt, response), `${receipt.id}-${response.decision}.pdf`, 'application/pdf');
    setNotice('Signed response PDF downloaded.');
  });
  document.querySelector('[data-response-json]')?.addEventListener('click', () => {
    downloadBytes(new TextEncoder().encode(JSON.stringify(response, null, 2)), `${receipt.id}-response.json`, 'application/json');
    setNotice('Response JSON downloaded.');
  });
}

function renderLegal(kind: 'privacy' | 'terms'): void {
  const privacy = `<main id="main" class="legal-main"><article><span class="section-kicker">PLAIN-LANGUAGE POLICY / 2026-08-28</span><h1>Privacy, without the fog.</h1><p class="lede">Delivery Receipt is built to avoid collecting your work in the first place.</p><h2>What stays on your device</h2><p>Receipt details, file metadata and hashes, client response records, and your license token are stored locally in your browser. File contents are read in chunks only to calculate a SHA-256 fingerprint. They are never stored by this app or placed in acknowledgement links.</p><h2>What a shared link contains</h2><p>An acknowledgement link contains the sender and client names, project, dates, note, file names, sizes, modified dates, file hashes, service items, receipt ID, creation time, and manifest hash. Anyone with that link can read those details, so do not include secrets.</p><h2>Network requests</h2><p>The core app has no analytics, advertising, account system, or sync. If you add a Studio license, the token is sent to the Sociobot API at most once per day to verify it. Selecting “Buy Studio” opens Sociobot’s hosted checkout; Dodo is merchant of record and applies its own checkout privacy terms.</p><h2>Your controls</h2><p>You can export all records as JSON, import them on another device, or delete individual records. Clearing this site’s browser storage removes local data and the saved license. We cannot recover it because we do not receive a copy.</p><h2>Contact</h2><p>Privacy questions: <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>.</p></article></main>`;
  const terms = `<main id="main" class="legal-main"><article><span class="section-kicker">USE TERMS / 2026-08-28</span><h1>Terms for a fair record.</h1><p class="lede">Use Delivery Receipt as a factual handoff aid—not as a threat, lock, or substitute for a sound contract.</p><h2>What the product does</h2><p>The app creates a local delivery manifest, hashes selected files, encodes an acknowledgement page, records a client’s stated response, and exports portable JSON and PDF records. It does not host or transfer files, hold funds, collect debt, provide escrow, verify identity, or guarantee payment.</p><h2>Evidence only</h2><p>A receipt is evidence of entered data and a stated response. It is not legal advice, a digital-signature service, or a representation that a record will be admissible or enforceable. Legal effect depends on the parties’ contract, facts, and jurisdiction. Seek qualified advice where needed.</p><h2>Your responsibilities</h2><p>Enter accurate information, protect links that contain confidential metadata, deliver work through a suitable channel, retain your own backups, and use the app lawfully. Do not present a response as identity-verified or tamper-proof beyond the included hash checks.</p><h2>Studio purchase</h2><p>Studio is a one-time ₹499 license for brand-free PDFs and a custom footer. Checkout and refunds are handled by Sociobot/Dodo as merchant of record. A refund or chargeback revokes the license. Core receipts, response recording, accessibility, and data export remain free.</p><h2>Availability and warranty</h2><p>The software is provided “as is,” without warranties to the extent allowed by law. You are responsible for exporting records you need. We may update or discontinue hosted access, but exported data remains yours and the code is MIT licensed.</p><h2>Contact</h2><p>Terms questions: <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p></article></main>`;
  app.innerHTML = shell(kind === 'privacy' ? privacy : terms, true);
}

async function initialize(): Promise<void> {
  const returned = captureReturnedLicense();
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/privacy') return renderLegal('privacy');
  if (path === '/terms') return renderLegal('terms');
  if (location.hash.startsWith('#ack=')) {
    try {
      const receipt = decodePortable<PublicReceipt>(location.hash.slice(5));
      if (!verifyReceipt(receipt)) throw new Error('manifest mismatch');
      state.ackReceipt = receipt;
      state.ackResponse = (await getResponses()).find((response) => response.receiptId === receipt.id && response.manifestHash === receipt.manifestHash);
      renderAcknowledgement(receipt);
    } catch { renderAcknowledgement(undefined, true); }
  } else {
    state.records = await getReceipts();
    renderHome();
  }
  if (returned || cachedLicense()) {
    const license = await verifyLicense(Boolean(returned));
    if (!location.hash.startsWith('#ack=') && path === '/') {
      renderHome();
      if (returned) setNotice(license?.valid ? 'Studio unlocked on this device.' : 'The returned license could not be verified.', !license?.valid);
    }
  }
}

window.addEventListener('online', () => { captureDraft(); setNotice('Back online. Local work stayed safe.'); initialize(); });
window.addEventListener('offline', () => { captureDraft(); setNotice('Offline. Core receipt tools still work.'); initialize(); });
window.addEventListener('hashchange', (event) => {
  if (location.hash.startsWith('#ack=') || (event as HashChangeEvent).oldURL.includes('#ack=')) void initialize();
});

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => setNotice('Offline setup could not finish. The app still works while connected.', true));
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'UPDATE_READY') setNotice('A fresh deck is ready. Reload when convenient.');
  });
}

void initialize().catch(() => {
  app.innerHTML = shell('<main id="main" class="bad-link"><h1>The local deck could not open.</h1><p>Your browser may be blocking local storage. Allow site data, then reload.</p><button class="button" type="button" onclick="location.reload()">Try again</button></main>', true);
});
