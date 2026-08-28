export type ReceiptStatus = 'draft' | 'sent' | 'accepted' | 'declined';
export type Decision = 'accepted' | 'declined';

export interface Deliverable {
  id: string;
  kind: 'file' | 'service';
  name: string;
  size?: number;
  lastModified?: number;
  sha256?: string;
}

export interface PublicReceipt {
  version: 1;
  id: string;
  project: string;
  freelancer: string;
  client: string;
  deliveryDate: string;
  dueDate?: string;
  note?: string;
  deliverables: Deliverable[];
  manifestHash: string;
  createdAt: string;
}

export interface ClientResponse {
  version: 1;
  receiptId: string;
  manifestHash: string;
  decision: Decision;
  clientName: string;
  note?: string;
  respondedAt: string;
  responseHash: string;
}

export interface ReceiptRecord extends PublicReceipt {
  status: ReceiptStatus;
  response?: ClientResponse;
}

export interface ExportBundle {
  product: 'delivery-acceptance-receipt';
  exportedAt: string;
  receipts: ReceiptRecord[];
  responses: ClientResponse[];
}
