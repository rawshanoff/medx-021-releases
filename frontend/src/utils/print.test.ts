import { describe, expect, it } from 'vitest';
import { defaultSettings } from './print';

describe('utils/print.defaultSettings', () => {
  it('returns stable defaults', () => {
    const s = defaultSettings();
    expect(s.paperSize).toBe('80');
    expect(s.receiptTemplateId).toBe('check-6');
    expect(typeof s.autoPrint).toBe('boolean');
  });
});
