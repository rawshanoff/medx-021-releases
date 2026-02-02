import * as React from "react";
import { cn } from "../../lib/cn";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        {
          default: "border-transparent bg-primary text-white",
          secondary: "border-transparent bg-secondary text-secondary-foreground",
          outline: "border-border bg-transparent text-foreground",
          destructive: "border-transparent bg-destructive text-white",
        }[variant],
        className
      )}
      {...props}
    />
  );
}

