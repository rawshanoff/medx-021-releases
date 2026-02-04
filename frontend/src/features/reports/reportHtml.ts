type Totals = { cash: number; card: number; transfer: number; total: number };

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmt(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString();
}

export function buildCashReportHtml({
  title,
  subtitle,
  shiftId,
  cashier,
  totals,
  currency,
  paperSize,
  receiptWidthMode,
  labels,
}: {
  title: string;
  subtitle?: string;
  shiftId?: number | string | null;
  cashier?: string | null;
  totals: Totals;
  currency: string;
  paperSize?: '58' | '80';
  receiptWidthMode?: 'standard' | 'safe';
  labels?: {
    shift?: string;
    cashier?: string;
    cash?: string;
    card?: string;
    transfer?: string;
    total?: string;
    footer?: string;
  };
}) {
  const lbl = {
    shift: labels?.shift || 'Shift',
    cashier: labels?.cashier || 'Cashier',
    cash: labels?.cash || 'Cash',
    card: labels?.card || 'Card',
    transfer: labels?.transfer || 'Transfer',
    total: labels?.total || 'Total',
    footer: labels?.footer || 'MedX',
  };
  const sub = subtitle ? `<div class="sub">${esc(subtitle)}</div>` : '';
  const sh =
    shiftId != null
      ? `<div class="meta"><span>${esc(lbl.shift)}:</span> #${esc(shiftId)}</div>`
      : '';
  const ca = cashier
    ? `<div class="meta"><span>${esc(lbl.cashier)}:</span> ${esc(cashier)}</div>`
    : '';
  const widthMm = paperSize === '58' ? 58 : 80;
  const contentMm = receiptWidthMode === 'safe' ? (paperSize === '58' ? 54 : 76) : widthMm;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: ${widthMm}mm auto; margin: 0; }
      html, body {
        width: ${widthMm}mm;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111827;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      .wrap { width: ${contentMm}mm; max-width: ${contentMm}mm; margin: 0 auto; padding: 14px 14px 10px; }
      .title { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
      .sub { margin-top: 4px; font-size: 12px; color: #6b7280; }
      .metaRow { margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 12px; color: #374151; }
      .meta span { color: #6b7280; }
      .box { margin-top: 12px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
      .row { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 12px; }
      .row:first-child { border-top: none; }
      .lbl { color: #6b7280; }
      .val { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-weight: 700; }
      .total { background: #f9fafb; font-size: 13px; }
      .footer { margin-top: 10px; font-size: 11px; color: #9ca3af; text-align: center; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="title">${esc(title)}</div>
      ${sub}
      <div class="metaRow">
        ${sh}
        ${ca}
      </div>
      <div class="box">
        <div class="row"><div class="lbl">${esc(lbl.cash)}</div><div class="val">${fmt(totals.cash)} ${esc(currency)}</div></div>
        <div class="row"><div class="lbl">${esc(lbl.card)}</div><div class="val">${fmt(totals.card)} ${esc(currency)}</div></div>
        <div class="row"><div class="lbl">${esc(lbl.transfer)}</div><div class="val">${fmt(totals.transfer)} ${esc(currency)}</div></div>
        <div class="row total"><div class="lbl">${esc(lbl.total)}</div><div class="val">${fmt(totals.total)} ${esc(currency)}</div></div>
      </div>
      <div class="footer">${esc(lbl.footer)}</div>
    </div>
  </body>
</html>`;
}
