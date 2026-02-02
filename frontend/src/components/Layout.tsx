import React, { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Main scroll container (prevents "content flies away" / no-scroll issues) */}
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </main>
    </div>
  );
}
