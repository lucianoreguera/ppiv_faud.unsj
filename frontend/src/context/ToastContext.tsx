import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ApiHttpError } from '../api/http-client';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const durationMs = toast.durationMs ?? 5000;

      setToasts((prev) => [...prev, { ...toast, id, durationMs }]);

      if (durationMs > 0) {
        window.setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }

      return id;
    },
    [dismissToast],
  );

  // Escuchar eventos globales de Rate Limiting (429 Retry-After) emitidos por http-client
  useEffect(() => {
    const handleRateLimit = (event: Event) => {
      const customEvent = event as CustomEvent<ApiHttpError>;
      const apiError = customEvent.detail;
      showToast({
        title: 'Límite de solicitudes excedido (429)',
        description:
          apiError?.message ??
          'Ha realizado demasiadas peticiones en poco tiempo. Aguarde unos segundos.',
        variant: 'warning',
        durationMs: 7000,
      });
    };

    window.addEventListener('faud:rate-limit', handleRateLimit);
    return () => window.removeEventListener('faud:rate-limit', handleRateLimit);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, clearToasts }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notificaciones del sistema"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const variantStyles: Record<
            ToastVariant,
            { container: string; icon: React.ReactNode }
          > = {
            success: {
              container: 'bg-status-success-bg border-status-success/30 text-status-success',
              icon: <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />,
            },
            warning: {
              container: 'bg-faud-amber-light border-faud-amber text-status-warning',
              icon: <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />,
            },
            error: {
              container: 'bg-status-danger-bg border-status-danger/30 text-status-danger',
              icon: <AlertCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />,
            },
            info: {
              container: 'bg-white border-faud-border-warm text-faud-ink',
              icon: <Info className="w-5 h-5 text-faud-gold-dark shrink-0 mt-0.5" />,
            },
          };

          const style = variantStyles[toast.variant];

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-card border shadow-lg transition-all ${style.container}`}
            >
              {style.icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs mt-1 opacity-90 leading-relaxed">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4 opacity-70" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe utilizarse dentro de un <ToastProvider>');
  }
  return context;
}
