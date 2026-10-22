import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Modal del Design System (Figma pág. 23: superficie blanca r:12 sobre velo #1A1A2E).
 * - role="dialog" + aria-modal, título enlazado con aria-labelledby.
 * - Escape y clic en el velo cierran (salvo `dismissible = false`, p. ej. mientras se envía una solicitud).
 * - Enfoca el primer control al abrir, mantiene el foco dentro con Tab y lo devuelve al cerrar.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  dismissible?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  footer,
  icon,
  dismissible = true,
  className = '',
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-faud-ink/60 p-0 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full sm:max-w-[520px] max-h-[92vh] overflow-y-auto bg-white rounded-t-card sm:rounded-card shadow-auth outline-none ${className}`}
      >
        <div className="flex items-start gap-3 px-5 sm:px-7 pt-5 sm:pt-6">
          {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
          <h2 id={titleId} className="flex-1 text-[18px] sm:text-h3 font-bold text-faud-ink leading-snug">
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 -mr-1 rounded-[4px] text-faud-muted hover:text-faud-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faud-amber"
              aria-label="Cerrar diálogo"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="px-5 sm:px-7 pt-4 pb-5 sm:pb-6 text-body text-faud-text">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 px-5 sm:px-7 py-4 border-t border-faud-border-warm bg-faud-cream/60 rounded-b-card">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
