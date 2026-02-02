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
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-colors shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85',
            secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
            outline: 'border border-border bg-transparent hover:bg-secondary/70',
            ghost: 'bg-transparent hover:bg-secondary/70',
            destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
          }[variant],
          {
            // Electron desktop: larger click targets (>= 44px)
            sm: 'h-10 px-4',
            md: 'h-12 px-6',
            lg: 'h-14 px-8',
            icon: 'h-12 w-12 p-0',
          }[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
