import React, { useEffect, useRef, useState } from 'react';

/**
 * Escudo antidescarga / antiimpresión / anticopia del Visor Protegido (RNF02 · Spec FE-04, regla 3).
 * - Bloquea menú contextual, arrastre, selección, copiar / cortar y los atajos Ctrl / Cmd + S, P, C, X, A.
 * - Mientras está montado, `body.drm-print-lock` hace que `@media print` imprima una hoja en blanco;
 *   además, `beforeprint` oculta el contenido por si el navegador ignora la regla CSS.
 * Es una barrera de cliente: la protección real es que el PDF nunca se expone como archivo descargable.
 */
export type DrmBlockedAction = 'guardar' | 'imprimir' | 'copiar' | 'seleccionar' | 'menu-contextual' | 'arrastrar';

const SHORTCUTS: Record<string, DrmBlockedAction> = {
  s: 'guardar',
  p: 'imprimir',
  c: 'copiar',
  x: 'copiar',
  a: 'seleccionar',
};

export const PRINT_LOCK_CLASS = 'drm-print-lock';

export interface DrmSecurityShieldProps {
  children: React.ReactNode;
  className?: string;
  onBlockedAction?: (action: DrmBlockedAction) => void;
}

export const DrmSecurityShield: React.FC<DrmSecurityShieldProps> = ({ children, className = '', onBlockedAction }) => {
  const [printing, setPrinting] = useState(false);
  const onBlockedRef = useRef(onBlockedAction);
  onBlockedRef.current = onBlockedAction;

  useEffect(() => {
    const notify = (action: DrmBlockedAction) => onBlockedRef.current?.(action);

    const blockKeys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const action = SHORTCUTS[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      notify(action);
    };
    const blockClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      notify('copiar');
    };
    const beforePrint = () => {
      setPrinting(true);
      notify('imprimir');
    };
    const afterPrint = () => setPrinting(false);

    document.body.classList.add(PRINT_LOCK_CLASS);
    window.addEventListener('keydown', blockKeys, { capture: true });
    document.addEventListener('copy', blockClipboard);
    document.addEventListener('cut', blockClipboard);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      document.body.classList.remove(PRINT_LOCK_CLASS);
      window.removeEventListener('keydown', blockKeys, { capture: true });
      document.removeEventListener('copy', blockClipboard);
      document.removeEventListener('cut', blockClipboard);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  const block = (action: DrmBlockedAction) => (event: React.SyntheticEvent) => {
    event.preventDefault();
    onBlockedRef.current?.(action);
  };

  return (
    <div
      data-testid="drm-security-shield"
      className={`drm-protected-view ${printing ? 'invisible' : ''} ${className}`}
      onContextMenu={block('menu-contextual')}
      onDragStart={block('arrastrar')}
    >
      {children}
    </div>
  );
};
