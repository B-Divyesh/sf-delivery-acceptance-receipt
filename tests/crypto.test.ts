import { describe, expect, it } from 'vitest';
import { decodePortable, encodePortable, hashText, makeResponseHash, manifestHash, verifyReceipt, verifyResponse } from '../src/crypto';
import { receiptPdf } from '../src/pdf';
import type { ClientResponse, PublicReceipt } from '../src/types';

const receipt: PublicReceipt = {
  version: 1,
  id: 'DR-20260828-TEST',
  project: 'Launch files',
  freelancer: 'North Studio',
  client: 'Sample Client',
  deliveryDate: '2026-08-28',
  createdAt: '2026-08-28T05:00:00.000Z',
  deliverables: [{ id: 'one', kind: 'service', name: 'Final workshop' }],
  manifestHash: ''
};
receipt.manifestHash = manifestHash(receipt.deliverables);

describe('portable evidence primitives', () => {
  it('implements SHA-256 correctly', () => {
    expect(hashText('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('round trips Unicode receipt data through a URL-safe payload', () => {
    const value = { project: 'Café identity — नमस्ते', count: 2 };
    const encoded = encodePortable(value);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodePortable(encoded)).toEqual(value);
  });

  it('detects a changed manifest', () => {
    expect(verifyReceipt(receipt)).toBe(true);
    expect(verifyReceipt({ ...receipt, project: 'Other title' })).toBe(true);
    expect(verifyReceipt({ ...receipt, deliverables: [{ ...receipt.deliverables[0], name: 'Changed' }] })).toBe(false);
  });

  it('rejects whitespace-only receipt identity fields', () => {
    for (const field of ['project', 'freelancer', 'client'] as const) {
      expect(verifyReceipt({ ...receipt, [field]: ' \t\n ' })).toBe(false);
    }
  });

  it('checks client response integrity', () => {
    const body: Omit<ClientResponse, 'responseHash'> = {
      version: 1,
      receiptId: receipt.id,
      manifestHash: receipt.manifestHash,
      decision: 'accepted',
      clientName: 'A. Client',
      respondedAt: '2026-08-28T05:10:00.000Z'
    };
    const response = { ...body, responseHash: makeResponseHash(body) };
    expect(verifyResponse(response)).toBe(true);
    expect(verifyResponse({ ...response, decision: 'declined' })).toBe(false);
    const blankNameBody = { ...body, clientName: '   ' };
    expect(verifyResponse({ ...blankNameBody, responseHash: makeResponseHash(blankNameBody) })).toBe(false);
  });

  it('builds a real PDF document containing receipt evidence', () => {
    const bytes = receiptPdf(receipt);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('MANIFEST SHA-256');
    expect(text).toContain('%%EOF');
  });
});
