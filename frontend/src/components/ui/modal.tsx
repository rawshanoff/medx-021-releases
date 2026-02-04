import { ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import * as ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './button';
import { useTranslation } from 'react-i18next';

function maxWFromWidth(width: number): string {
  // Keep modals comfortably sized on 1366x768 / Electron.
  // We still accept "width" as a hint, but clamp to modern dialog widths.
  if (width >= 1000) return 'max-w-3xl'; // ~768px
  if (width >= 880) return 'max-w-2xl'; // ~672px
  if (width >= 760) return 'max-w-xl'; // ~576px
  return 'max-w-lg'; // ~512px
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  width = 860,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useTranslation();
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const prevOverflowRef = useRef<string>('');

  const portalTarget = useMemo<HTMLElement | null>(() => {
    // Ensure we always portal to document.body (avoids stacking/transform clipping).
    try {
      if (typeof document === 'undefined') return null;
      return document.body || null;
    } catch {
      return null;
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    // Remember focus and lock background scroll
    try {
      lastActiveRef.current = document.activeElement as HTMLElement | null;
    } catch {}
    try {
      prevOverflowRef.current = document.body?.style?.overflow || '';
      if (document.body?.style) document.body.style.overflow = 'hidden';
    } catch {}

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      try {
        if (document.body?.style) document.body.style.overflow = prevOverflowRef.current || '';
      } catch {}
      // Restore focus back to what user was doing
      try {
        lastActiveRef.current?.focus?.();
      } catch {}
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      className={cn(
        'fixed z-[9999] flex items-center justify-center p-4',
        // "Blurred" backdrop. On systems without blur support it becomes plain dimming.
        'bg-black/55 backdrop-blur-sm supports-[backdrop-filter]:bg-black/40',
      )}
      style={{ top: 0, right: 0, bottom: 0, left: 0 }}
      onMouseDown={(e) => {
        const isBackdrop = e.target === e.currentTarget;
        if (isBackdrop) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          // Modern dialog: centered, rounded, shadow, inner scroll if content is tall
          // Width is set via CSS min() to avoid relying on max-w-* utilities
          'rounded-xl border border-border bg-card text-foreground shadow-2xl',
          // Never stretch edge-to-edge
          'w-[min(720px,calc(100vw-2rem))]',
          maxWFromWidth(width),
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">{title}</div>
            {description ? (
              <div className="mt-0.5 text-[13px] text-muted-foreground">{description}</div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );

  // Always portal if possible; fallback only if DOM is unavailable.
  try {
    if (portalTarget && typeof (ReactDOM as any).createPortal === 'function') {
      return (ReactDOM as any).createPortal(content, portalTarget);
    }
  } catch {}
  return content;
}
