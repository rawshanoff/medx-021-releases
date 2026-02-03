import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/cn';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    // Date.now() can collide when multiple toasts are created in the same ms.
    const id =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex max-w-[420px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-foreground shadow-sm"
          >
            <div className="flex min-w-0 items-start gap-2">
              {toast.type === 'success' && (
                <CheckCircle size={16} className="mt-0.5 text-[hsl(var(--success))]" />
              )}
              {toast.type === 'error' && (
                <AlertCircle size={16} className="mt-0.5 text-destructive" />
              )}
              {toast.type === 'warning' && (
                <AlertCircle size={16} className="mt-0.5 text-[hsl(var(--warning))]" />
              )}
              {toast.type === 'info' && <Info size={16} className="mt-0.5 text-primary" />}
              <span className="min-w-0 truncate text-[13px] font-medium">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground',
                'hover:bg-secondary hover:text-foreground',
              )}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
