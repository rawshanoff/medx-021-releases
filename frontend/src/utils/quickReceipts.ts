import client from '../api/client';

export type QuickReceiptBinding = {
  id: string;
  hotkey: string;
  doctorId: number | null;
  serviceId: number | null;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
};

export type QuickReceiptConfig = {
  enabled: boolean;
  bindings: QuickReceiptBinding[];
};

export const defaultQuickReceiptConfig: QuickReceiptConfig = {
  enabled: false,
  bindings: [],
};

export async function getQuickReceiptConfig(): Promise<QuickReceiptConfig> {
  try {
    const res = await client.get('/system/settings/quick_receipts');
    const value = (res.data?.value ?? res.data) as Partial<QuickReceiptConfig> | undefined;
    return { ...defaultQuickReceiptConfig, ...(value || {}) };
  } catch {
    return defaultQuickReceiptConfig;
  }
}

export async function setQuickReceiptConfig(next: QuickReceiptConfig): Promise<QuickReceiptConfig> {
  await client.put('/system/settings/quick_receipts', { value: next });
  return next;
}
