import * as React from 'react';

import { cn } from '../lib/cn';

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('p-6', className)}>{children}</div>;
}
