const DIGITS = /[0-9]/g;

export function formatDobInput(raw: string): string {
  const digits = (raw.match(DIGITS) || []).join('').slice(0, 8); // DDMMYYYY
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (!mm) return dd;
  if (!yyyy) return `${dd}.${mm}`;
  return `${dd}.${mm}.${yyyy}`;
}

export function dobUiToIso(ui: string): string | null {
  // expects DD.MM.YYYY
  const digits = (ui.match(DIGITS) || []).join('');
  if (digits.length !== 8) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  // basic validation
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function dobIsoToUi(iso?: string | null): string {
  if (!iso) return '';
  const pure = String(iso).split('T')[0];
  const parts = pure.split('-');
  if (parts.length !== 3) return '';
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return '';
  return `${dd}.${mm}.${yyyy}`;
}

export function normalizeHumanName(input: string): string {
  const cleaned = input.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  // Keep separators but normalize alpha casing within segments.
  const parts = cleaned.split(' ').map((word) => normalizeNameToken(word));
  return parts.join(' ');
}

function normalizeNameToken(token: string): string {
  // Split by hyphen and apostrophes, normalize each segment, keep separators
  const segments = token.split(/([-’'])/g);
  return segments
    .map((seg, idx) => {
      if (seg === '-' || seg === "'" || seg === '’') return seg;
      // After an apostrophe in Uzbek-like names, next segment should stay lowercase:
      // e.g. Ulug'bek, O'g'il.
      const prev = idx > 0 ? segments[idx - 1] : '';
      if (prev === "'" || prev === '’') return seg.toLocaleLowerCase();
      // After hyphen we keep Title Case (Jean-Luc)
      return capitalize(seg);
    })
    .join('');
}

function capitalize(seg: string): string {
  if (!seg) return seg;
  const lower = seg.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}
