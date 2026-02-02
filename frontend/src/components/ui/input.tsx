import * as React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          // Electron desktop: larger input with readable text
          'flex h-[48px] w-full rounded-[12px] border border-border bg-background px-[20px] py-[12px] text-[16px] text-foreground shadow-sm transition-colors',
          'placeholder:text-muted-foreground',
          'hover:border-[hsl(var(--ring))]',
          'focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[2px] focus-visible:ring-offset-[hsl(var(--background))]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
