import { useEffect, useState } from 'react';
import { loansApi } from '../api/loans.api';
import { useAuth } from '../context/AuthContext';
import { buildLoginPath } from '../routes/auth-redirect';
import type { DocumentItemDto, LoanItemDto } from '../types/openapi.types';

/**
 * Acción contextual de la Ficha Bibliográfica (Spec FE-02, regla 3):
 * - checking:    verificando sesión o préstamos del usuario
 * - login:       visitante → /login?redirect=/documentos/:id
 * - open-viewer: el usuario ya tiene un préstamo ACTIVO vigente sobre la obra → /visor/:prestamoId
 * - request:     documento habilitado → "Solicitar Préstamo Digital (7 días)"
 * - unavailable: documento suspendido por Biblioteca (disponible = false)
 */
export type LoanAction =
  | { kind: 'checking' }
  | { kind: 'login'; to: string }
  | { kind: 'open-viewer'; to: string; codigo: string }
  | { kind: 'request' }
  | { kind: 'unavailable' };

interface ActiveLoanLookup {
  documentId: string;
  loan: LoanItemDto | null;
}

export function useDocumentLoanAction(doc: DocumentItemDto | null): LoanAction {
  const { status } = useAuth();
  const [lookup, setLookup] = useState<ActiveLoanLookup | null>(null);
  const documentId = doc?.id;

  useEffect(() => {
    if (!documentId || status !== 'authenticated') return;
    const controller = new AbortController();
    loansApi
      .myLoans({ estado: 'ACTIVO' }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const loan = response.items.find((l) => l.documento.id === documentId && l.vigente) ?? null;
        setLookup({ documentId, loan });
      })
      .catch(() => {
        // Sin acceso a "mis préstamos" se ofrece la solicitud; un 401 cierra la sesión vía http-client
        if (!controller.signal.aborted) setLookup({ documentId, loan: null });
      });
    return () => controller.abort();
  }, [documentId, status]);

  if (!doc || status === 'loading') return { kind: 'checking' };
  if (status === 'anonymous') return { kind: 'login', to: buildLoginPath(`/documentos/${doc.id}`) };
  if (lookup?.documentId !== doc.id) return { kind: 'checking' };
  if (lookup.loan) {
    return { kind: 'open-viewer', to: `/visor/${lookup.loan.id}`, codigo: lookup.loan.codigoFormateado };
  }
  return doc.estaDisponible ? { kind: 'request' } : { kind: 'unavailable' };
}
