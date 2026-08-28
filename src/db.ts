import type { ClientResponse, ExportBundle, ReceiptRecord } from './types';

const DATABASE = 'delivery-receipt';
const VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
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

export async function importBundle(bundle: ExportBundle): Promise<void> {
  if (bundle.product !== 'delivery-acceptance-receipt' || !Array.isArray(bundle.receipts) || !Array.isArray(bundle.responses)) {
    throw new Error('That file is not a Delivery Receipt export.');
  }
  await Promise.all(bundle.receipts.map(saveReceipt));
  await Promise.all(bundle.responses.map(saveResponse));
}
