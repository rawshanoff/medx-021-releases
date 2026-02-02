import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/cn';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild, ...props }, ref) => {
    const Comp: any = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-[12px] whitespace-nowrap rounded-[12px] text-[16px] font-medium transition-colors shadow-sm',
          'focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[2px] focus-visible:ring-offset-[hsl(var(--background))]',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85',
            secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
            outline: 'border border-border bg-transparent hover:bg-secondary/70',
            ghost: 'bg-transparent hover:bg-secondary/70',
            destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
          }[variant],
          {
            // Electron desktop: larger click targets (>= 48px)
            sm: 'h-[48px] px-[20px]',
            md: 'h-[48px] px-[24px]',
            lg: 'h-[56px] px-[32px]',
            icon: 'h-[48px] w-[48px] p-0',
          }[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
