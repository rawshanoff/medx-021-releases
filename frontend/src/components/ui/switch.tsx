import { cn } from '../../lib/cn';

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-5 w-9 items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        disabled ? 'opacity-50' : 'cursor-pointer',
        checked
          ? 'border-blue-600/60 bg-blue-600 dark:border-blue-500/60 dark:bg-blue-500'
          : 'border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700',
        className,
      )}
    >
      <span
        className={cn(
          'h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-1',
        )}
      />
    </button>
  );
}
