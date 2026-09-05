import { makeResponseHash, manifestHash, verifyReceipt, verifyResponse } from './crypto';
import type { ClientResponse, Deliverable, ExportBundle, ReceiptRecord } from './types';

type StorageMode = 'real' | 'demo';

const DATABASE = 'delivery-receipt';
const VERSION = 1;
let storageMode: StorageMode = 'real';

export function setStorageMode(mode: StorageMode): void {
  storageMode = mode;
}

export function currentStorageMode(): StorageMode {
  return storageMode;
}

function databaseName(mode = storageMode): string {
  return mode === 'demo' ? `demo:${DATABASE}` : DATABASE;
}

function openDatabase(mode = storageMode): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName(mode), VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('receipts')) db.createObjectStore('receipts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('responses')) db.createObjectStore('responses', { keyPath: 'responseHash' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage'));
  });
}

async function run<T>(storeName: 'receipts' | 'responses', mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage action failed'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('Local storage transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage transaction aborted'));
  });
}

export const saveReceipt = (receipt: ReceiptRecord) => run('receipts', 'readwrite', (store) => store.put(receipt));
export const getReceipt = (id: string) => run<ReceiptRecord | undefined>('receipts', 'readonly', (store) => store.get(id));
export const getReceipts = () => run<ReceiptRecord[]>('receipts', 'readonly', (store) => store.getAll());
export const deleteReceipt = (id: string) => run('receipts', 'readwrite', (store) => store.delete(id));
export const saveResponse = (response: ClientResponse) => run('responses', 'readwrite', (store) => store.put(response));
export const getResponses = () => run<ClientResponse[]>('responses', 'readonly', (store) => store.getAll());

export async function exportBundle(): Promise<ExportBundle> {
  return {
    product: 'delivery-acceptance-receipt',
    exportedAt: new Date().toISOString(),
    receipts: await getReceipts(),
    responses: await getResponses()
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isIsoTime = (value: unknown): value is string => hasText(value) && Number.isFinite(Date.parse(value));
const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every((key) => allowed.includes(key));

function validRecord(value: unknown): value is ReceiptRecord {
  if (!isObject(value) || !hasOnlyKeys(value, ['version', 'id', 'project', 'freelancer', 'client', 'deliveryDate', 'dueDate', 'note', 'deliverables', 'manifestHash', 'createdAt', 'status', 'response'])) return false;
  const { status, response, ...receipt } = value;
  if (!verifyReceipt(receipt)) return false;
  if (!['draft', 'sent', 'accepted', 'declined'].includes(String(value.status))) return false;
  if (!isIsoTime(value.createdAt)) return false;
  if (status === 'accepted' || status === 'declined') {
    if (!response || !verifyResponse(response) || response.receiptId !== value.id || response.manifestHash !== value.manifestHash || status !== response.decision) return false;
  } else if (response !== undefined) {
    return false;
  }
  return true;
}

function assertValidBundle(value: unknown): asserts value is ExportBundle {
  if (!isObject(value) || value.product !== 'delivery-acceptance-receipt' || !Array.isArray(value.receipts) || !Array.isArray(value.responses) || !isIsoTime(value.exportedAt)) {
    throw new Error('That file is not a valid Delivery Receipt export. No local records were changed.');
  }
  if (!value.receipts.every(validRecord) || !value.responses.every(verifyResponse)) {
    throw new Error('That archive has an invalid receipt or response. No local records were changed.');
  }
  const receiptIds = new Set<string>();
  for (const receipt of value.receipts) {
    if (receiptIds.has(receipt.id)) throw new Error('That archive repeats a receipt ID. No local records were changed.');
    receiptIds.add(receipt.id);
  }
  const responseHashes = new Set<string>();
  for (const response of value.responses) {
    if (responseHashes.has(response.responseHash)) throw new Error('That archive repeats a response. No local records were changed.');
    responseHashes.add(response.responseHash);
    const receipt = value.receipts.find((candidate) => candidate.id === response.receiptId);
    if (!receipt || receipt.manifestHash !== response.manifestHash) {
      throw new Error('That archive has a response for a missing or changed receipt. No local records were changed.');
    }
  }
  for (const receipt of value.receipts) {
    if (receipt.response && !responseHashes.has(receipt.response.responseHash)) {
      throw new Error('That archive is missing a receipt response. No local records were changed.');
    }
  }
}

/** Validates every row before one IndexedDB transaction writes any row. */
export async function importBundle(value: unknown): Promise<void> {
  assertValidBundle(value);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['receipts', 'responses'], 'readwrite');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('The archive could not be imported. No local records were changed.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('The archive could not be imported. No local records were changed.')); };
    const receipts = transaction.objectStore('receipts');
    const responses = transaction.objectStore('responses');
    for (const receipt of value.receipts) receipts.put(receipt);
    for (const response of value.responses) responses.put(response);
  });
}

async function clearStores(mode: StorageMode): Promise<void> {
  const db = await openDatabase(mode);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['receipts', 'responses'], 'readwrite');
    transaction.objectStore('receipts').clear();
    transaction.objectStore('responses').clear();
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not reset sample data')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Could not reset sample data')); };
  });
}

function sampleBundle(): ExportBundle {
  const deliverables: Deliverable[] = [
    { id: 'sample-file-1', kind: 'file', name: 'Northstar-brand-guidelines.pdf', size: 2841640, lastModified: 1788192000000, sha256: '3a64a86d7b2eb7e5c14f9aa70c2c7bb113052c3c98ee1a74b3a6be197ebd047f' },
    { id: 'sample-service-1', kind: 'service', name: 'Final logo files and usage walkthrough' }
  ];
  const receipt = {
    version: 1 as const,
    id: 'DR-SAMPLE-NORTHSTAR',
    project: 'Northstar Coffee launch',
    freelancer: 'Mara Vale Studio',
    client: 'Inez Rahman, Northstar Coffee',
    deliveryDate: '2026-09-01',
    dueDate: '2026-09-08',
    note: 'Files were sent through the client’s shared drive after the final approval call.',
    deliverables,
    manifestHash: manifestHash(deliverables),
    createdAt: '2026-09-01T15:20:00.000Z'
  };
  const responseBody: Omit<ClientResponse, 'responseHash'> = {
    version: 1,
    receiptId: receipt.id,
    manifestHash: receipt.manifestHash,
    decision: 'accepted',
    clientName: 'Inez Rahman',
    note: 'The files and walkthrough match our final approval.',
    respondedAt: '2026-09-01T17:05:00.000Z'
  };
  const response = { ...responseBody, responseHash: makeResponseHash(responseBody) };
  return { product: 'delivery-acceptance-receipt', exportedAt: '2026-09-01T17:05:00.000Z', receipts: [{ ...receipt, status: 'accepted', response }], responses: [response] };
}

export async function ensureDemoData(): Promise<void> {
  if (storageMode !== 'demo') throw new Error('Sample data can only be opened in demo storage.');
  if ((await getReceipts()).length) return;
  await importBundle(sampleBundle());
}

export async function resetDemoData(): Promise<void> {
  await clearStores('demo');
  const wasMode = storageMode;
  storageMode = 'demo';
  try {
    await importBundle(sampleBundle());
  } finally {
    storageMode = wasMode;
  }
}
