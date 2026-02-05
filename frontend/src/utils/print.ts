import client from '../api/client';
import { loggers } from './logger';

export type PrintSettings = {
  clinicName: string;
  clinicPhone: string;
  clinicAddress: string;
  footerNote: string;
  underQrText: string;
  logoDataUrl: string; // base64 data URL
  autoPrint: boolean;
  preferredPrinterName: string; // shown on receipt, actual selection happens in OS/Electron
  preferredPrinterDeviceName: string; // Electron deviceName
  boldAllText: boolean; // make whole receipt bold for readability
  showTotalAmount: boolean; // show money totals / amounts on receipt
  showPaymentType: boolean; // show payment type line on receipt
  // Fine-grained receipt visibility toggles
  showLogo: boolean;
  showClinicName: boolean;
  showClinicPhone: boolean;
  showClinicAddress: boolean;
  showDateTime: boolean;
  showQueue: boolean;
  showPatientName: boolean;
  showDoctor: boolean;
  showDoctorRoom: boolean;
  showServices: boolean;
  showQr: boolean;
  showUnderQrText: boolean;
  showFooterNote: boolean;
  silentPrintMode: 'html' | 'image'; // Electron silent printing mode
  silentScalePercent: number; // Electron webContents.print scaleFactor (10..200)
  logoMaxMm: number; // max logo height in mm
  fontScalePercent: number; // receipt font scale (60..140)
  receiptWidthMode: 'standard' | 'safe'; // full width vs safe width with margins
  receiptTemplateId: ReceiptTemplateId;
  paperSize: '58' | '80';
  qrUrl: string;
  qrImageDataUrl: string; // generated once; used instead of remote QR
};

const RECEIPT_STORAGE_PREFIX = 'medx-receipt:';

export type ReceiptTemplateId = 'check-4-58' | 'check-1' | 'check-6';

// Cache for synchronous access to print settings
let _cachedSettings: PrintSettings | null = null;

/**
 * Get cached print settings synchronously.
 * Returns cached settings or defaults if not yet loaded.
 * Use getPrintSettings() for fresh data from server.
 */
export function getCachedPrintSettings(): PrintSettings {
  return _cachedSettings ?? defaultSettings();
}

/**
 * Get print settings from server (via API).
 * Falls back to defaults if not found.
 * Also updates the cached settings for synchronous access.
 *
 * Called on app startup or manually refreshed.
 */
export async function getPrintSettings(): Promise<PrintSettings> {
  try {
    const response = await client.get('/system/settings/print_config');
    const value = response.data?.value || response.data;
    if (value && typeof value === 'object') {
      const settings = { ...defaultSettings(), ...value } as PrintSettings;
      _cachedSettings = settings;
      return settings;
    }
  } catch (e) {
    loggers.print.warn('Failed to load print settings from server, using defaults', e);
  }
  const defaults = defaultSettings();
  _cachedSettings = defaults;
  return defaults;
}

/**
 * Save print settings to server (via API).
 *
 * Returns the saved settings from server.
 */
export async function setPrintSettings(next: PrintSettings): Promise<PrintSettings> {
  try {
    const response = await client.put('/system/settings/print_config', {
      value: next,
    });
    const value = response.data?.value || response.data;
    if (value && typeof value === 'object') {
      return value as PrintSettings;
    }
  } catch (e) {
    loggers.print.error('Failed to save print settings to server', e);
    throw e;
  }
  return next;
}

export function defaultSettings(): PrintSettings {
  return {
    clinicName: 'MedX Clinic',
    clinicPhone: '',
    clinicAddress: '',
    footerNote: '',
    underQrText: '',
    logoDataUrl: '',
    autoPrint: false,
    preferredPrinterName: '',
    preferredPrinterDeviceName: '',
    boldAllText: true,
    showTotalAmount: true,
    showPaymentType: true,
    showLogo: true,
    showClinicName: true,
    showClinicPhone: true,
    showClinicAddress: true,
    showDateTime: true,
    showQueue: true,
    showPatientName: true,
    showDoctor: true,
    showDoctorRoom: true,
    showServices: true,
    showQr: true,
    showUnderQrText: true,
    showFooterNote: true,
    silentPrintMode: 'html',
    silentScalePercent: 100,
    logoMaxMm: 20,
    fontScalePercent: 100,
    receiptWidthMode: 'standard',
    receiptTemplateId: 'check-6',
    paperSize: '80',
    qrUrl: '',
    qrImageDataUrl: '',
  };
}

export type PrintableQueueItem = {
  ticket_number: string;
  patient_name: string;
  doctor_name?: string;
  created_at?: string;
};

export type PrintWindow = Window | null;

export function openPrintWindow(): PrintWindow {
  // IMPORTANT: must be called directly from a user gesture (click/keydown) to avoid popup blockers
  // Avoid noopener/noreferrer here because we need to write into the window reliably.
  return window.open('', '_blank', 'width=520,height=720');
}

function writeHtmlToWindow(opened: PrintWindow, html: string) {
  if (!opened) return;
  try {
    opened.document.open();
    opened.document.write(html);
    opened.document.close();
    opened.focus();
  } catch {
    // ignore
  }
}

function isElectronRuntime(): boolean {
  // preload will expose this when running inside Electron
  return Boolean((window as any)?.medx?.isElectron);
}

async function electronSilentPrintHtml(
  html: string,
  deviceName: string,
  paperSize: PrintSettings['paperSize'],
  mode: PrintSettings['silentPrintMode'],
  scaleFactor: number,
): Promise<boolean> {
  try {
    const api = (window as any)?.medx;
    if (!api?.printHtml) return false;
    // Pass paper size so main process can set a proper pageSize.
    await api.printHtml({ html, deviceName, silent: true, paperSize, scaleFactor, mode });
    return true;
  } catch {
    return false;
  }
}

export function printQueueTicket(
  item: PrintableQueueItem,
  settings?: PrintSettings,
  win?: PrintWindow,
) {
  const s = settings ?? getCachedPrintSettings();
  const widthMm = s.paperSize === '58' ? 58 : 80;
  const contentMm = s.receiptWidthMode === 'safe' ? (s.paperSize === '58' ? 54 : 76) : widthMm;

  const created = item.created_at ? new Date(item.created_at) : null;
  const createdStr = created ? created.toLocaleString() : '';

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ticket ${escapeHtml(item.ticket_number)}</title>
    <style>
      :root { color-scheme: light; }
      @page { size: ${widthMm}mm auto; margin: 0; }
      html, body { width: ${widthMm}mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
      .receipt { width: ${contentMm}mm; max-width: ${contentMm}mm; margin: 0 auto; padding: 4mm 2mm 6mm; }
      .h { text-align: center; margin-bottom: 12px; }
      .name { font-weight: 700; font-size: 16px; margin-top: 6px; }
      .ticket { font-weight: 900; font-size: 44px; letter-spacing: 1px; margin: 10px 0; }
      .meta { font-size: 12px; color: #334155; margin-top: 6px; }
      .line { border-top: 1px dashed #cbd5e1; margin: 12px 0; }
      .footer { margin-top: 12px; font-size: 12px; color: #475569; text-align: center; }
      @media print {
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="h">
      <div style="font-weight:700">${escapeHtml(s.clinicName)}</div>
      ${s.clinicPhone ? `<div class="meta">${escapeHtml(s.clinicPhone)}</div>` : ''}
      ${s.clinicAddress ? `<div class="meta">${escapeHtml(s.clinicAddress)}</div>` : ''}
      <div class="line"></div>
      <div class="ticket">${escapeHtml(item.ticket_number)}</div>
      <div class="name">${escapeHtml(item.patient_name)}</div>
      ${item.doctor_name ? `<div class="meta">${escapeHtml(item.doctor_name)}</div>` : ''}
      ${createdStr ? `<div class="meta">${escapeHtml(createdStr)}</div>` : ''}
      <div class="line"></div>
      ${s.footerNote ? `<div class="footer">${escapeHtml(s.footerNote)}</div>` : ''}
      </div>
    </div>
  </body>
</html>`;

  // Electron: silent printing without any dialogs/windows
  if (s.autoPrint && isElectronRuntime()) {
    const scaleFactor = Number.isFinite(Number(s.silentScalePercent))
      ? Number(s.silentScalePercent)
      : 100;
    void electronSilentPrintHtml(
      html,
      s.preferredPrinterDeviceName || '',
      s.paperSize,
      s.silentPrintMode || 'image',
      scaleFactor,
    );
    return;
  }

  // Browser/dev preview: open a window; printing will be done via user action or browser dialog if needed
  const opened = win ?? openPrintWindow();
  writeHtmlToWindow(opened, html);
  if (s.autoPrint) {
    // Best-effort browser printing: may show dialog; never call twice.
    try {
      opened?.setTimeout?.(() => opened?.print?.(), 80);
    } catch {}
  }
}

export type ReceiptPayload = {
  receiptNo: string; // e.g. AA-000156 or tx id
  ticket: string; // A-021
  createdAtIso: string; // ISO string
  patientName: string;
  doctorName?: string;
  doctorRoom?: string;
  serviceName: string;
  amount: number;
  currency: string;
  paymentMethod: string; // CASH/CARD/TRANSFER/MIXED
  paymentBreakdown?: { cash?: number; card?: number; transfer?: number };
};

export function saveReceiptForTicket(ticket: string, payload: ReceiptPayload) {
  try {
    localStorage.setItem(RECEIPT_STORAGE_PREFIX + ticket, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadReceiptForTicket(ticket: string): ReceiptPayload | null {
  try {
    const raw = localStorage.getItem(RECEIPT_STORAGE_PREFIX + ticket);
    if (!raw) return null;
    return JSON.parse(raw) as ReceiptPayload;
  } catch {
    return null;
  }
}

export function printReceipt(payload: ReceiptPayload, settings?: PrintSettings, win?: PrintWindow) {
  const s = settings ?? getCachedPrintSettings();

  const html = buildReceiptHtml(payload, s);
  // Electron: silent printing without dialogs/windows
  if (s.autoPrint && isElectronRuntime()) {
    const scaleFactor = Number.isFinite(Number(s.silentScalePercent))
      ? Number(s.silentScalePercent)
      : 100;
    void electronSilentPrintHtml(
      html,
      s.preferredPrinterDeviceName || '',
      s.paperSize,
      s.silentPrintMode || 'image',
      scaleFactor,
    );
    return;
  }

  const opened = win ?? openPrintWindow();
  writeHtmlToWindow(opened, html);
  if (s.autoPrint) {
    try {
      opened?.setTimeout?.(() => opened?.print?.(), 120);
    } catch {}
  }
}

export function buildReceiptHtml(p: ReceiptPayload, s: PrintSettings): string {
  const created = new Date(p.createdAtIso);
  const dateStr = created.toLocaleDateString('ru-RU');
  const timeStr = created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const money = formatMoney(p.amount);
  const showTotal = s.showTotalAmount !== false;
  const showPayment = s.showPaymentType !== false;
  const payLabel = formatPaymentUz(p.paymentMethod, p.paymentBreakdown, p.currency, showTotal);
  const doctor = (p.doctorName || '').trim();
  const doctorRoom = (p.doctorRoom || '').trim();
  const widthMm = s.paperSize === '58' ? 58 : 80;
  const contentMm = s.receiptWidthMode === 'safe' ? (s.paperSize === '58' ? 54 : 76) : widthMm;
  const fontScalePercent =
    typeof s.fontScalePercent === 'number' && Number.isFinite(s.fontScalePercent)
      ? s.fontScalePercent
      : 100;
  const fontScale = Math.min(Math.max(fontScalePercent, 60), 140) / 100;
  const scalePx = (px: number) => `${Math.max(1, Math.round(px * fontScale))}px`;
  const defaultLogoMm = widthMm === 58 ? 20 : 16;
  const logoMaxMm =
    typeof s.logoMaxMm === 'number' && Number.isFinite(s.logoMaxMm) ? s.logoMaxMm : defaultLogoMm;
  const logoMmClamped = Math.min(Math.max(logoMaxMm, 8), 40);
  const qr = s.qrUrl ? escapeHtml(s.qrUrl) : '';
  const underQr = (s.underQrText || '').trim();
  const logo = (s.logoDataUrl || '').trim();
  const qrImage = (s.qrImageDataUrl || '').trim();
  const boldAll = Boolean(s.boldAllText);

  const doctorLine =
    s.showDoctor !== false && doctor
      ? `<div class="queue-doctor">${escapeHtml(
          doctor + (s.showDoctorRoom !== false && doctorRoom ? ` — ${doctorRoom}` : ''),
        )}</div>`
      : '';

  const commonHead = `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chek</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #fff; color: #000; ${boldAll ? 'font-weight: 900;' : ''} }
      @page { size: ${widthMm}mm auto; margin: 0; }
      html, body { width: ${widthMm}mm; }
      @media print { body { margin: 0; padding: 0; } }
      .receipt { width: ${contentMm}mm; max-width: ${contentMm}mm; margin: 0 auto; padding: ${widthMm === 58 ? '4mm 2mm 6mm' : '4mm 3mm 6mm'}; font-family: "Courier New", monospace; }
      .center { text-align: center; }
      .row { display:flex; justify-content:space-between; gap: 8px; font-size: ${scalePx(12)}; }
      .row > span { min-width: 0; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .logo { font-weight: 900; font-size: ${scalePx(16)}; text-transform: uppercase; }
      .sub { font-size: ${scalePx(11)}; line-height: 1.2; }
      .logo-slot { display:flex; align-items:center; justify-content:center; margin: 2px 0 6px; min-height: ${logoMmClamped + 2}mm; }
      .logo-img { max-width: 100%; max-height: ${logoMmClamped}mm; object-fit: contain; }
      .queue { text-align:center; margin: 8px 0; }
      .queue-label { font-size: ${scalePx(11)}; text-transform: uppercase; }
      .queue-num { font-size: ${scalePx(widthMm === 58 ? 42 : 44)}; font-weight: 900; letter-spacing: 2px; line-height: 1; }
      .queue-doctor { margin-top: 4px; font-size: ${scalePx(widthMm === 58 ? 12 : 13)}; font-weight: 900; }
      .title { font-weight: 800; margin-top: 4px; font-size: ${scalePx(12)}; }
      .value { font-weight: 900; font-size: ${scalePx(13)}; word-break: break-word; }
      .total { display:flex; justify-content:space-between; font-weight: 900; font-size: ${scalePx(14)}; }
      .small { font-size: ${scalePx(11)}; }
      .qr { display:block; margin: 10px auto 4px; width: ${widthMm === 58 ? '120px' : '140px'}; height: ${widthMm === 58 ? '120px' : '140px'}; }
      .underqr { margin-top: 6px; font-size: ${scalePx(11)}; text-align: center; }
    </style>
  `;

  const headerBlock = `
    <div class="center">
      ${
        s.showClinicName !== false
          ? `<div class="logo">${escapeHtml(s.clinicName || 'KLINIKA')}</div>`
          : ``
      }
      <div class="sub">
        ${
          s.showClinicAddress !== false && s.clinicAddress
            ? `${escapeHtml(s.clinicAddress)}<br>`
            : ``
        }
        ${s.showClinicPhone !== false && s.clinicPhone ? `tel: ${escapeHtml(s.clinicPhone)}` : ``}
      </div>
    </div>
  `;

  const logoBlock =
    s.showLogo !== false
      ? `
    <div class="logo-slot">
      ${logo ? `<img class="logo-img" src="${escapeHtml(logo)}" alt="logo" />` : ''}
    </div>
  `
      : ``;

  const footer =
    s.showFooterNote !== false
      ? `
    <div class="divider"></div>
    <div class="center small">
      ${s.footerNote ? escapeHtml(s.footerNote) : 'Спасибо за доверие!'}
    </div>
  `
      : ``;

  const underQrLine =
    s.showUnderQrText !== false && underQr
      ? `<div class="underqr">${escapeHtml(underQr)}</div>`
      : '';

  const qrImg =
    s.showQr !== false
      ? qrImage
        ? `<img class="qr" src="${escapeHtml(qrImage)}" alt="QR">`
        : qr
          ? `<img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(
              s.qrUrl,
            )}" alt="QR">`
          : ''
      : '';

  if (s.receiptTemplateId === 'check-4-58') {
    // Inspired by check-4 58.html (Uz)
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
${commonHead}
  <style>
    .queue-box { border: 2px solid #000; border-radius: 8px; padding: 6px 6px; }
    .service-row { display:flex; justify-content:space-between; align-items:flex-end; margin-top: 8px; }
    .service-name { font-weight: 900; font-size: ${scalePx(12)}; }
    .price { font-weight: 900; font-size: ${scalePx(16)}; }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoBlock}
    ${headerBlock}
    <div class="divider"></div>
    ${
      s.showDateTime !== false
        ? `<div class="row"><span>${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span><span></span></div>`
        : ``
    }
    <div class="divider"></div>

    ${
      s.showQueue !== false
        ? `<div class="queue queue-box">
      <div class="queue-label">NAVBAT RAQAMINGIZ</div>
      <div class="queue-num">${escapeHtml(p.ticket)}</div>
      ${doctorLine}
    </div>`
        : ``
    }

    ${
      s.showPatientName !== false
        ? `<div class="title">Bemor (Mijoz):</div>
    <div class="value">${escapeHtml(p.patientName)}</div>`
        : ``
    }

    <div class="divider"></div>

    ${
      s.showServices !== false
        ? `<div class="title">Xizmat turi:</div>
    <div class="value">${escapeHtml(p.serviceName)}</div>`
        : ``
    }

    <div class="divider"></div>

    ${
      showTotal
        ? `
      <div class="service-row">
        <div class="service-name">JAMI:</div>
        <div class="price">${escapeHtml(money)} ${escapeHtml(p.currency)}</div>
      </div>
    `
        : ``
    }

    ${showPayment ? `<div class="row small" style="margin-top: 4px;"><span>To'lov turi:</span><span>${escapeHtml(payLabel)}</span></div>` : ``}

    ${qrImg}
    ${underQrLine}
    ${footer}
  </div>
</body>
</html>`;
  }

  if (s.receiptTemplateId === 'check-1') {
    // Inspired by check-1.html (80mm border + huge ticket)
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
${commonHead}
  <style>
    .wrap { border: 2px dashed #000; padding: 8mm 4mm; text-align: center; font-size: ${scalePx(14)}; }
    .queue-num { font-size: ${scalePx(48)}; letter-spacing: 3px; }
    .service { font-size: ${scalePx(16)}; font-weight: 900; margin-top: 10px; }
    .price { font-size: ${scalePx(22)}; font-weight: 900; }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoBlock}
    <div class="wrap">
      ${headerBlock}
      <div class="divider"></div>
      ${
        s.showDateTime !== false
          ? `<div class="center"><strong>${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</strong></div>`
          : ``
      }
      <div class="divider"></div>
      ${
        s.showPatientName !== false || s.showQueue !== false
          ? `<div style="text-align:left">
        ${s.showPatientName !== false ? `Bemor: <strong>${escapeHtml(p.patientName)}</strong><br><br>` : ``}
        ${s.showQueue !== false ? `Sizning navbat raqamingiz:` : ``}
      </div>`
          : ``
      }
      ${
        s.showQueue !== false
          ? `<div class="queue-num">${escapeHtml(p.ticket)}</div>${doctorLine}`
          : ``
      }
      ${doctorLine}
      <div class="divider"></div>
      ${s.showServices !== false ? `<div class="service">${escapeHtml(p.serviceName)}</div>` : ``}
      ${showTotal ? `<div class="price">${escapeHtml(money)} ${escapeHtml(p.currency)}</div>` : ``}
      <div class="divider"></div>
      ${showPayment ? `<div class="small">To'lov turi: ${escapeHtml(payLabel)}</div>` : ``}
      ${qrImg}
      ${underQrLine}
      ${footer}
    </div>
  </div>
</body>
</html>`;
  }

  // default: check-6 (table-ish 80mm)
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
${commonHead}
  <style>
    .table-header, .table-row { display:flex; justify-content:space-between; font-size: ${scalePx(12)}; }
    .table-header span { font-weight: 900; border-bottom: 1px dashed #000; padding-bottom: 2px; }
    .col-service { width: 60%; text-align: left; }
    .col-qty { width: 10%; text-align: center; }
    .col-price { width: 30%; text-align: right; }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoBlock}
    ${headerBlock}
    <div class="divider"></div>
    ${
      s.showDateTime !== false
        ? `<div class="row"><span>Sana:</span><span>${escapeHtml(dateStr)}</span></div>
    <div class="row"><span>Vaqt:</span><span>${escapeHtml(timeStr)}</span></div>`
        : ``
    }
    <div class="divider"></div>

    ${
      s.showPatientName !== false
        ? `<div class="title">Bemor:</div>
    <div class="value">${escapeHtml(p.patientName)}</div>`
        : ``
    }
    <div class="divider"></div>

    ${
      s.showQueue !== false
        ? `<div class="queue">
      <div class="queue-label">Sizning navbat raqamingiz</div>
      <div class="queue-num">${escapeHtml(p.ticket)}</div>
      ${doctorLine}
    </div>`
        : ``
    }
    <div class="divider"></div>

    ${
      s.showServices !== false
        ? `<div class="title">Ko'rsatiladigan xizmatlar:</div>
    <div class="table-header">
      <span class="col-service">Xizmat</span>
      <span class="col-qty">Soni</span>
      <span class="col-price">Narxi</span>
    </div>
    <div class="table-row">
      <span class="col-service">${escapeHtml(p.serviceName)}</span>
      <span class="col-qty">1</span>
      <span class="col-price">${showTotal ? escapeHtml(money) : ''}</span>
    </div>`
        : ``
    }

    <div class="divider"></div>
    ${showTotal ? `<div class="total"><span>Jami to'lov:</span><span>${escapeHtml(money)} ${escapeHtml(p.currency)}</span></div>` : ``}
    ${showPayment ? `<div class="row small" style="margin-top: 2px;"><span>To'lov turi:</span><span>${escapeHtml(payLabel)}</span></div>` : ``}

    ${qrImg}
    ${underQrLine}
    ${footer}
  </div>
</body>
</html>`;
}

function formatMoney(amount: number): string {
  try {
    return Number(amount || 0).toLocaleString('ru-RU');
  } catch {
    return String(amount || 0);
  }
}

function formatPaymentUz(
  method: string,
  breakdown?: ReceiptPayload['paymentBreakdown'],
  currency?: string,
  includeAmounts: boolean = true,
): string {
  const c = (currency || '').trim();
  const m = (method || '').toUpperCase();
  const labelMap: Record<string, string> = {
    CASH: 'Naqd',
    CARD: 'Karta',
    TRANSFER: 'O‘tkazma',
    MIXED: 'Aralash',
  };
  if (m !== 'MIXED') return labelMap[m] || m;
  if (!includeAmounts) return labelMap[m] || m;
  const parts: string[] = [];
  if (breakdown?.cash) parts.push(`Naqd: ${formatMoney(breakdown.cash)}${c ? ` ${c}` : ''}`);
  if (breakdown?.card) parts.push(`Karta: ${formatMoney(breakdown.card)}${c ? ` ${c}` : ''}`);
  if (breakdown?.transfer)
    parts.push(`O‘tkazma: ${formatMoney(breakdown.transfer)}${c ? ` ${c}` : ''}`);
  return parts.length ? parts.join(' / ') : labelMap[m] || m;
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
