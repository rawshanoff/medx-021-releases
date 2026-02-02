import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './button';
import { useTranslation } from 'react-i18next';

function maxWFromWidth(width: number): string {
  if (width >= 1000) return 'max-w-5xl';
  if (width >= 880) return 'max-w-4xl';
  if (width >= 760) return 'max-w-3xl';
  return 'max-w-2xl';
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'w-full rounded-md border border-border bg-card p-4 text-foreground shadow-sm',
          maxWFromWidth(width)
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">{title}</div>
            {description ? <div className="mt-0.5 text-[12px] text-muted-foreground">{description}</div> : null}
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

        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

