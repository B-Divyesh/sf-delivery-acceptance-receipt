import type { ClientResponse, Deliverable, PublicReceipt } from './types';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export class Sha256 {
  private state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private buffer = new Uint8Array(64);
  private bufferLength = 0;
  private bytesHashed = 0;
  private finished = false;

  update(data: Uint8Array): this {
    if (this.finished) throw new Error('Hash is already finalized');
    this.bytesHashed += data.length;
    let position = 0;
    while (position < data.length) {
      const take = Math.min(data.length - position, 64 - this.bufferLength);
      this.buffer.set(data.subarray(position, position + take), this.bufferLength);
      this.bufferLength += take;
      position += take;
      if (this.bufferLength === 64) {
        this.hashBuffer();
        this.bufferLength = 0;
      }
    }
    return this;
  }

  digest(): string {
    if (!this.finished) {
      const bits = this.bytesHashed * 8;
      this.buffer[this.bufferLength++] = 0x80;
      if (this.bufferLength > 56) {
        this.buffer.fill(0, this.bufferLength);
        this.hashBuffer();
        this.bufferLength = 0;
      }
      this.buffer.fill(0, this.bufferLength, 56);
      const high = Math.floor(bits / 0x100000000);
      const low = bits >>> 0;
      new DataView(this.buffer.buffer).setUint32(56, high);
      new DataView(this.buffer.buffer).setUint32(60, low);
      this.hashBuffer();
      this.finished = true;
    }
    return Array.from(this.state, (word) => word.toString(16).padStart(8, '0')).join('');
  }

  private hashBuffer(): void {
    const w = new Uint32Array(64);
    const view = new DataView(this.buffer.buffer);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.state;
    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    const values = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) this.state[i] = (this.state[i] + values[i]) >>> 0;
  }
}

export function hashText(value: string): string {
  return new Sha256().update(new TextEncoder().encode(value)).digest();
}

export async function hashFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const hasher = new Sha256();
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const data = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    hasher.update(data);
    onProgress?.(Math.min(100, Math.round(((offset + data.length) / Math.max(file.size, 1)) * 100)));
  }
  if (file.size === 0) onProgress?.(100);
  return hasher.digest();
}

export function manifestHash(deliverables: Deliverable[]): string {
  const stable = deliverables.map(({ kind, name, size = null, lastModified = null, sha256 = null }) => ({
    kind, name, size, lastModified, sha256
  }));
  return hashText(JSON.stringify(stable));
}

export function makeResponseHash(response: Omit<ClientResponse, 'responseHash'>): string {
  return hashText(JSON.stringify(response));
}

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function verifyReceipt(receipt: PublicReceipt): boolean {
  return receipt.version === 1 && [receipt.id, receipt.project, receipt.freelancer, receipt.client].every(hasText) &&
    Array.isArray(receipt.deliverables) && receipt.deliverables.length > 0 && manifestHash(receipt.deliverables) === receipt.manifestHash;
}

export function verifyResponse(response: ClientResponse): boolean {
  const { responseHash, ...body } = response;
  return response.version === 1 && ['accepted', 'declined'].includes(response.decision) &&
    [response.receiptId, response.clientName, response.respondedAt].every(hasText) && makeResponseHash(body) === responseHash;
}

export function encodePortable(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodePortable<T>(value: string): T {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
