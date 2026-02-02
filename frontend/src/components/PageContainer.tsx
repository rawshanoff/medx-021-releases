import * as React from 'react';

import { cn } from '../lib/cn';

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Use explicit px-based spacing to ensure consistent Electron layout.
  return <div className={cn('p-[24px]', className)}>{children}</div>;
}
