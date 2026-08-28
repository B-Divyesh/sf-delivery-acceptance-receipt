import type { ClientResponse, PublicReceipt } from './types';

function clean(value: string): string {
  return value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrap(value: string, width = 88): string[] {
  const words = clean(value).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

function pdfDocument(lines: string[]): Uint8Array {
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 46)) }, (_, index) => lines.slice(index * 46, index * 46 + 46));
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';
  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const text = `BT\n/F1 10 Tf\n14 TL\n54 778 Td\n${pageLines.map((line, lineIndex) => `${lineIndex ? 'T* ' : ''}(${clean(line)}) Tj`).join('\n')}\nET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(text).length} >>\nstream\n${text}\nendstream`;
  });
  let output = '%PDF-1.4\n%DR01\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = new TextEncoder().encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export function receiptPdf(receipt: PublicReceipt, response?: ClientResponse, customFooter?: string, brandFree = false): Uint8Array {
  const status = response?.decision.toUpperCase() ?? 'DELIVERED / AWAITING RESPONSE';
  const lines = [
    'DELIVERY RECEIPT',
    '=======================================================================',
    `STATUS       ${status}`,
    `RECEIPT ID   ${receipt.id}`,
    `PROJECT      ${receipt.project}`,
    `FROM         ${receipt.freelancer}`,
    `FOR          ${receipt.client}`,
    `DELIVERED    ${receipt.deliveryDate}`,
    ...(receipt.dueDate ? [`INVOICE DUE  ${receipt.dueDate}`] : []),
    `CREATED UTC  ${receipt.createdAt}`,
    '',
    'MANIFEST'
  ];
  receipt.deliverables.forEach((item, index) => {
    lines.push(`${String(index + 1).padStart(2, '0')}  [${item.kind.toUpperCase()}] ${item.name}`);
    if (item.kind === 'file') {
      lines.push(`    ${item.size ?? 0} bytes | modified ${item.lastModified ? new Date(item.lastModified).toISOString() : 'unknown'}`);
      lines.push(`    SHA-256 ${item.sha256}`);
    }
  });
  lines.push('', `MANIFEST SHA-256 ${receipt.manifestHash}`);
  if (receipt.note) lines.push('', 'HANDOFF NOTE', ...wrap(receipt.note));
  if (response) {
    lines.push('', 'CLIENT RESPONSE', `DECISION      ${response.decision.toUpperCase()}`, `RESPONDED BY  ${response.clientName}`, `RESPONDED UTC ${response.respondedAt}`, `RESPONSE HASH ${response.responseHash}`);
    if (response.note) lines.push(...wrap(`NOTE          ${response.note}`));
  }
  lines.push('', 'EVIDENCE NOTICE', ...wrap('This receipt records a delivery manifest and a stated response. It is evidence only, not legal advice, escrow, payment collection, or a guarantee of legal effect. Effect depends on your contract and jurisdiction.'));
  if (customFooter) lines.push('', ...wrap(customFooter));
  if (!brandFree) lines.push('', 'Made with Delivery Receipt | delivery-acceptance-receipt.sociobot.in');
  return pdfDocument(lines);
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
