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
  ({ className, variant = 'default', size = 'sm', asChild, ...props }, ref) => {
    const Comp: any = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            default: 'bg-primary text-primary-foreground hover:opacity-90',
            secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
            outline: 'border border-border bg-transparent hover:bg-secondary',
            ghost: 'bg-transparent hover:bg-secondary',
            destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
          }[variant],
          {
            // High density: 28px/32px controls
            sm: 'h-7 px-2.5',
            md: 'h-8 px-3',
            lg: 'h-9 px-3.5',
            icon: 'h-8 w-8 p-0',
          }[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
