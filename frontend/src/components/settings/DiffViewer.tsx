import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';

type AnyJson = any;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function stableStringify(v: unknown) {
  try {
    return JSON.stringify(v, Object.keys(isPlainObject(v) ? v : {}).sort(), 2);
  } catch {
    try {
      return String(v);
    } catch {
      return '[unserializable]';
    }
  }
}

function summarize(v: unknown) {
  if (v === null) return 'null';
  if (v === undefined) return '—';
  if (typeof v === 'string') return v.length > 64 ? `${v.slice(0, 64)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return 'Object';
  return String(v);
}

export function DiffViewer({
  oldValue,
  newValue,
  className,
}: {
  oldValue: AnyJson;
  newValue: AnyJson;
  className?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const changes = useMemo(() => {
    // Best-effort, human-readable diff:
    // - if both are objects: compare top-level keys
    // - otherwise: treat as a single value change
    if (isPlainObject(oldValue) && isPlainObject(newValue)) {
      const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)])).sort();
      const out: Array<{ key: string; before: unknown; after: unknown }> = [];
      for (const k of keys) {
        const before = (oldValue as any)[k];
        const after = (newValue as any)[k];
        // Deep compare by stringify (good enough for audit UX)
        const same = stableStringify(before) === stableStringify(after);
        if (!same) out.push({ key: k, before, after });
      }
      return out;
    }
    if (stableStringify(oldValue) === stableStringify(newValue)) return [];
    return [{ key: 'value', before: oldValue, after: newValue }];
  }, [oldValue, newValue]);

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Изменения</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {changes.length === 0
              ? 'Нет отличий (или изменения не распознаны).'
              : `Изменено полей: ${changes.length}`}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 px-3 text-xs"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? 'Скрыть детали' : 'Показать детали'}
        </Button>
      </div>

      {changes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {changes.map((c) => (
            <li
              key={c.key}
              className="rounded-lg border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-900/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {c.key}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200/70 bg-white px-3 py-2 text-xs dark:border-slate-700/50 dark:bg-slate-800">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Было
                  </div>
                  <div className="mt-1 break-words text-slate-900 dark:text-slate-50">
                    {summarize(c.before)}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200/70 bg-white px-3 py-2 text-xs dark:border-slate-700/50 dark:bg-slate-800">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Стало
                  </div>
                  <div className="mt-1 break-words text-slate-900 dark:text-slate-50">
                    {summarize(c.after)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {showDetails ? (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-900/30">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Было (raw)
            </div>
            <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-900 dark:text-slate-50">
              {stableStringify(oldValue)}
            </pre>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-900/30">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Стало (raw)
            </div>
            <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-900 dark:text-slate-50">
              {stableStringify(newValue)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
