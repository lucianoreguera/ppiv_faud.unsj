import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Undo2 } from 'lucide-react';
import { loansApi } from '../../api/loans.api';
import { ApiHttpError, removeDrmToken, setDrmToken } from '../../api/http-client';
import { CountdownBadge } from '../../components/loans/CountdownBadge';
import { LoanActions, LoanCard } from '../../components/loans/LoanCard';
import { getLoanStatus, MY_LOANS_TABS, parseMyLoansTab, type MyLoansTab } from '../../components/loans/loan-status';
import { Alert } from '../../components/ui/Alert';
import { TabPill } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { InfoDot } from '../../components/ui/Decorations';
import { Modal } from '../../components/ui/Modal';
import { useNotifications } from '../../context/NotificationsContext';
import { useToast } from '../../context/ToastContext';
import { useNow } from '../../hooks/useNow';
import { formatDate, formatDateTime, isLoanReadable } from '../../utils/loan-time';
import type { LoanItemDto, MyLoansListResponseDto } from '../../types/openapi.types';

/**
 * Mis préstamos (Figma págs. 13 y 19 · Spec FE-03, reglas 2 y 3) — GET /api/v1/prestamos/mis-prestamos
 * - Pestañas con los contadores del Backend; la pestaña activa viaja en `?tab=` (los avisos de la campana enlazan aquí).
 * - Cuenta regresiva en vivo a partir de `fechaVencimiento` y alerta ámbar dentro de las últimas 24h (RF06).
 * - "Devolver" (ACTIVO) y "Archivar" (VENCIDO / REVOCADO) → PATCH /api/v1/prestamos/:id/cerrar.
 * - El `tokenAcceso` DRM de cada préstamo vigente se guarda para el Visor Protegido; el de los finalizados se descarta.
 */
type PageState =
  | { status: 'loading' }
  | { status: 'ready'; data: MyLoansListResponseDto }
  | { status: 'error'; message: string };

const errorMessage = (error: unknown) =>
  error instanceof ApiHttpError && error.code === 'NETWORK_ERROR'
    ? 'No pudimos comunicarnos con el Repositorio FAUD. Verificá tu conexión e intentá nuevamente.'
    : error instanceof Error
      ? error.message
      : 'Intentá nuevamente en unos instantes.';

function syncDrmTokens(items: LoanItemDto[]) {
  for (const loan of items) {
    if (loan.vigente && loan.tokenAcceso) setDrmToken(loan.id, loan.tokenAcceso);
    else removeDrmToken(loan.id);
  }
}

const TableSkeleton: React.FC = () => (
  <div role="status" className="mt-8 space-y-3 animate-pulse">
    <span className="sr-only">Cargando tus préstamos…</span>
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-20 rounded-card bg-white border border-faud-border-warm" />
    ))}
  </div>
);

export const MyLoansPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseMyLoansTab(searchParams.get('tab'));
  const { showToast } = useToast();
  const { refresh: refreshNotifications } = useNotifications();
  const now = useNow();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [closing, setClosing] = useState<LoanItemDto | null>(null);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const expiredSyncRef = useRef(new Set<string>());
  const hasDataRef = useRef(false);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    loansApi
      .myLoans({}, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        syncDrmTokens(data.items);
        hasDataRef.current = true;
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Con datos ya cargados se conserva la lista y solo se avisa del fallo de la actualización
        if (hasDataRef.current) {
          showToast({ title: 'No pudimos actualizar tus préstamos', description: errorMessage(error), variant: 'error' });
          return;
        }
        setState({ status: 'error', message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [reloadToken, showToast]);

  // Un préstamo ACTIVO que vence con la página abierta: se pide al Backend que sincronice el estado VENCIDO
  const items = state.status === 'ready' ? state.data.items : [];
  useEffect(() => {
    const justExpired = items.filter(
      (l) => l.estado === 'ACTIVO' && !isLoanReadable(l, now) && !expiredSyncRef.current.has(l.id),
    );
    if (justExpired.length === 0) return;
    justExpired.forEach((l) => {
      expiredSyncRef.current.add(l.id);
      removeDrmToken(l.id);
    });
    reload();
  }, [items, now, reload]);

  const selectTab = (id: MyLoansTab) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'activos') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const confirmClose = async () => {
    if (!closing) return;
    setCloseSubmitting(true);
    try {
      const response = await loansApi.close(closing.id);
      removeDrmToken(closing.id);
      showToast({
        title: closing.estado === 'ACTIVO' ? `Préstamo ${closing.codigoFormateado} devuelto` : `Préstamo ${closing.codigoFormateado} archivado`,
        description: response.message,
        variant: 'success',
      });
      setClosing(null);
      reload();
      refreshNotifications();
    } catch (error) {
      showToast({ title: 'No pudimos cerrar el préstamo', description: errorMessage(error), variant: 'error' });
      setClosing(null);
      reload();
    } finally {
      setCloseSubmitting(false);
    }
  };

  const activeTab = MY_LOANS_TABS.find((t) => t.id === tab)!;
  const contadores = state.status === 'ready' ? state.data.contadores : null;
  const loans = items.filter(activeTab.matches);
  const closingIsReturn = closing?.estado === 'ACTIVO';

  return (
    <div className="relative lg:min-h-[calc(100vh-64px)]">
      {/* Guías verticales del contenedor y acentos diagonales (Figma pág. 13) */}
      <div aria-hidden="true" className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="max-w-[1240px] h-full mx-auto border-x border-faud-amber/20" />
        <span className="absolute left-0 top-[180px] w-10 h-px bg-faud-amber/40 -rotate-45 origin-left" />
        <span className="absolute right-0 top-[560px] w-14 h-px bg-faud-amber/40 -rotate-45 origin-right" />
      </div>

      <div className="relative max-w-[1240px] mx-auto px-5 lg:px-0 pt-4 lg:pt-12 pb-12">
        <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-ink leading-tight">Mis préstamos</h1>
        <p className="hidden lg:block text-[16px] text-faud-muted">Gestiona tus documentos digitales solicitados.</p>

        <div role="tablist" aria-label="Filtrar préstamos" className="mt-3 lg:mt-4 flex gap-2 lg:gap-2.5 overflow-x-auto no-scrollbar">
          {MY_LOANS_TABS.map((t) => (
            <TabPill key={t.id} active={tab === t.id} onClick={() => selectTab(t.id)}>
              {t.label}
              {contadores && ` (${t.count(contadores)})`}
            </TabPill>
          ))}
        </div>

        {contadores && contadores.porVencer24h > 0 && tab !== 'por-vencer' && (
          <Alert
            variant="warning"
            title={
              contadores.porVencer24h === 1
                ? 'Tenés 1 préstamo que vence en las próximas 24 horas'
                : `Tenés ${contadores.porVencer24h} préstamos que vencen en las próximas 24 horas`
            }
            className="mt-4"
          >
            <button type="button" onClick={() => selectTab('por-vencer')} className="font-bold underline">
              Ver préstamos por vencer
            </button>
          </Alert>
        )}

        {state.status === 'loading' && <TableSkeleton />}

        {state.status === 'error' && (
          <div className="mt-8 max-w-xl">
            <Alert variant="danger" title="No pudimos cargar tus préstamos">
              {state.message}
            </Alert>
            <Button
              className="mt-4"
              onClick={() => {
                setState({ status: 'loading' });
                reload();
              }}
            >
              Reintentar
            </Button>
          </div>
        )}

        {state.status === 'ready' && loans.length === 0 && (
          <section className="mt-8 rounded-card border border-faud-border-warm bg-white px-6 py-10 text-center">
            <p className="text-body text-faud-muted">{activeTab.empty}</p>
            <Link to="/catalogo" className={buttonClasses('secondary', 'md', 'mt-4')}>
              Explorar el catálogo
            </Link>
          </section>
        )}

        {state.status === 'ready' && loans.length > 0 && (
          <>
            {/* Desktop: tabla (Figma pág. 13) */}
            <div className="hidden lg:block mt-8 bg-white rounded-card overflow-hidden">
              <table className="w-full text-left">
                <thead className="table-head">
                  <tr className="h-[48px]">
                    <th className="pl-8 font-bold">Documento</th>
                    <th className="w-[130px] font-bold">Inicio</th>
                    <th className="w-[170px] font-bold">Vence</th>
                    <th className="w-[210px] font-bold">Estado</th>
                    <th className="w-[300px] pr-6 font-bold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => {
                    const status = getLoanStatus(loan, now);
                    const muted = !status.readable;
                    return (
                      <tr key={loan.id} className="h-20 border-t border-faud-border-warm">
                        <td className="pl-8 py-3">
                          <p className="text-[11px] font-bold text-faud-muted">{loan.codigoFormateado}</p>
                          <Link
                            to={`/documentos/${loan.documento.id}`}
                            className={`text-[15px] font-bold hover:underline ${muted ? 'text-faud-muted' : 'text-faud-ink'}`}
                          >
                            {loan.documento.titulo}
                          </Link>
                          <p className="text-caption text-faud-muted mt-0.5">{loan.documento.autor}</p>
                        </td>
                        <td className={`text-body ${muted ? 'text-faud-muted' : 'text-faud-text'}`}>
                          {formatDate(loan.fechaInicio)}
                        </td>
                        <td className={`text-body ${muted ? 'text-faud-muted' : 'text-faud-text'}`}>
                          {formatDateTime(loan.fechaVencimiento)}
                        </td>
                        <td className="py-3">
                          <CountdownBadge loan={loan} status={status} now={now} />
                        </td>
                        <td className="pr-6">
                          <LoanActions loan={loan} status={status} onClose={setClosing} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="h-5" />
            </div>

            {/* Mobile: tarjetas con barra superior de estado (Figma pág. 19) */}
            <div className="lg:hidden mt-5 space-y-4">
              {loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} status={getLoanStatus(loan, now)} now={now} onClose={setClosing} />
              ))}
            </div>
          </>
        )}

        {/* Recordatorio automático (RF06) */}
        <div className="mt-4 lg:mt-10 flex items-start lg:items-center gap-3 lg:gap-4 rounded-input border border-faud-amber bg-faud-amber-light px-3 lg:px-7 py-3 lg:py-6 text-caption lg:text-body">
          <InfoDot tone="amber" className="mt-0.5 lg:mt-0" />
          <p className="text-faud-ink">
            <strong className="text-status-warning">Recordatorio automático:</strong>
            <span className="hidden lg:inline">
              {' '}
              Recibirás un correo electrónico y un aviso en la campana 24 horas antes de que venza un préstamo.
            </span>
            <span className="lg:hidden">
              <br />
              Correo y aviso 24h antes del vencimiento.
            </span>
          </p>
        </div>
      </div>

      <Modal
        open={closing !== null}
        onClose={() => setClosing(null)}
        dismissible={!closeSubmitting}
        title={closingIsReturn ? `¿Devolver el préstamo ${closing?.codigoFormateado}?` : `¿Archivar el préstamo ${closing?.codigoFormateado}?`}
        icon={
          closingIsReturn ? (
            <Undo2 className="w-6 h-6 text-faud-gold-dark" />
          ) : (
            <Archive className="w-6 h-6 text-faud-gold-dark" />
          )
        }
        footer={
          <>
            <Button variant="neutral" onClick={() => setClosing(null)} disabled={closeSubmitting}>
              Cancelar
            </Button>
            <Button variant={closingIsReturn ? 'danger' : 'primary'} onClick={confirmClose} isLoading={closeSubmitting}>
              {closingIsReturn ? 'Devolver préstamo' : 'Archivar préstamo'}
            </Button>
          </>
        }
      >
        {closing && (
          <>
            <p>
              <strong className="text-faud-ink">{closing.documento.titulo}</strong> · {closing.documento.autor}
            </p>
            <p className="mt-2 text-faud-muted">
              {closingIsReturn
                ? 'Al devolverlo perderás el acceso al Visor Protegido de inmediato. Si lo necesitás de nuevo, podrás solicitar un nuevo préstamo de 7 días.'
                : 'El préstamo pasará al estado CERRADO y quedará en tu historial.'}
            </p>
          </>
        )}
      </Modal>
    </div>
  );
};
