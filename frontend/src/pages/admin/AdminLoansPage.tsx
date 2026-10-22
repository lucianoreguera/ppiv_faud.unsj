import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Search, ShieldOff } from 'lucide-react';
import { loansApi } from '../../api/loans.api';
import { notificationsApi } from '../../api/notifications.api';
import { AdminActionModal } from '../../components/admin/AdminActionModal';
import { CronSummaryModal } from '../../components/admin/CronSummaryModal';
import { KpiCard } from '../../components/admin/KpiCard';
import { NotificationsAuditPanel } from '../../components/admin/NotificationsAuditPanel';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Alert } from '../../components/ui/Alert';
import { Badge, KeywordTag, TabPill, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { InfoDot } from '../../components/ui/Decorations';
import { SelectField, TextField } from '../../components/ui/FormField';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../context/ToastContext';
import { useAdminPanel } from '../../hooks/useAdminIndicators';
import { useDepartmentOptions } from '../../hooks/useDepartmentOptions';
import { useNow } from '../../hooks/useNow';
import { useSearchDraft } from '../../hooks/useSearchDraft';
import { describeApiError } from '../../utils/api-error';
import { formatDate, formatDateTime, formatRemaining, getRemainingTime } from '../../utils/loan-time';
import {
  ESTADOS_PRESTAMO,
  type AdminLoansListResponseDto,
  type CronExecutionSummaryResponseDto,
  type EstadoPrestamo,
  type LoanItemDto,
} from '../../types/openapi.types';
import {
  parseAdminLoansParams,
  toAdminAuditApiParams,
  toAdminLoansApiParams,
  writeAdminLoansParams,
  type AdminLoansQuery,
} from './admin-params';

/**
 * Control de préstamos (Figma págs. 9 y 17 · Spec FE-05 regla 3 · RF04, RF06)
 * GET /api/v1/prestamos (métricas + listado paginado) · PATCH /api/v1/prestamos/:id/revocar
 * POST /api/v1/notificaciones/ejecutar-control-vigencia · GET /api/v1/notificaciones/admin (pestaña Auditoría)
 */
const ESTADO_LABEL: Record<EstadoPrestamo, string> = {
  ACTIVO: 'Activo',
  SOLICITADO: 'Solicitado',
  VENCIDO: 'Vencido',
  REVOCADO: 'Revocado',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
};

export interface AdminLoanStatusView {
  variant: BadgeVariant;
  label: string;
  /** Vence en menos de 24 h o ya venció hoy: se resalta en rojo */
  urgent: boolean;
  revocable: boolean;
  /** "en 5 d 3 h" · "venció el 22/10/2026" */
  remaining: string;
}

/** Estado tal como lo ve Biblioteca: un ACTIVO cuyo plazo ya pasó se muestra vencido aunque el Backend no lo haya sincronizado */
export function getAdminLoanStatus(loan: LoanItemDto, now = Date.now()): AdminLoanStatusView {
  const remaining = getRemainingTime(loan.fechaVencimiento, now);
  if (loan.estado === 'ACTIVO' && !remaining.expired) {
    return remaining.within24h
      ? { variant: 'alert', label: 'Por vencer', urgent: true, revocable: true, remaining: `en ${formatRemaining(remaining)}` }
      : { variant: 'success', label: 'Activo', urgent: false, revocable: true, remaining: `en ${formatRemaining(remaining)}` };
  }
  const expiredView = loan.estado === 'ACTIVO' || loan.estado === 'VENCIDO';
  return {
    variant: expiredView || loan.estado === 'REVOCADO' ? 'danger' : loan.estado === 'SOLICITADO' ? 'warning' : 'inactive',
    label: expiredView ? 'Vencido' : ESTADO_LABEL[loan.estado],
    urgent: expiredView && formatDate(loan.fechaVencimiento) === formatDate(new Date(now)),
    revocable: false,
    remaining:
      loan.estado === 'REVOCADO'
        ? `revocado el ${formatDate(loan.updatedAt)}`
        : loan.estado === 'CERRADO'
          ? `cerrado el ${formatDate(loan.updatedAt)}`
          : expiredView
            ? `venció el ${formatDate(loan.fechaVencimiento)}`
            : '—',
  };
}

/** Miniatura de documento (hoja con esquina plegada) */
const DocThumb: React.FC<{ folded?: boolean }> = ({ folded }) => (
  <span aria-hidden="true" className="relative inline-block w-[30px] h-10 shrink-0 bg-faud-cream border border-faud-border-warm">
    {folded && (
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 30 40" fill="none">
        <path d="M2 2l12 12M14 2l14 14" stroke="#E8DCC8" />
      </svg>
    )}
  </span>
);

const revokeClass =
  'inline-flex items-center justify-center rounded-[4px] bg-white border border-status-danger text-status-danger font-bold hover:bg-status-danger-bg transition-colors';

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; data: AdminLoansListResponseDto }
  | { status: 'error'; message: string };

export const AdminLoansPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseAdminLoansParams(searchParams);
  const { showToast } = useToast();
  const { refreshIndicators } = useAdminPanel();
  const departments = useDepartmentOptions();
  const now = useNow();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [revoking, setRevoking] = useState<LoanItemDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningCron, setRunningCron] = useState(false);
  const [cronSummary, setCronSummary] = useState<CronExecutionSummaryResponseDto | null>(null);
  const hasDataRef = useRef(false);
  const apiKey = JSON.stringify(toAdminLoansApiParams(query));

  const updateQuery = (patch: Partial<AdminLoansQuery>, replace = false) =>
    setSearchParams(writeAdminLoansParams({ ...query, page: 1, ...patch }), { replace });
  const [searchDraft, setSearchDraft] = useSearchDraft(query.q, (q) => updateQuery({ q }, true));

  // Las métricas se muestran en ambas vistas; el listado se consulta con los filtros de la vista Préstamos
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    loansApi
      .adminList(JSON.parse(apiKey), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        hasDataRef.current = true;
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (hasDataRef.current) {
          showToast({ title: 'No pudimos actualizar los préstamos', description: describeApiError(error), variant: 'error' });
          return;
        }
        setState({ status: 'error', message: describeApiError(error) });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [apiKey, reloadToken, showToast]);

  const reloadAll = () => {
    setReloadToken((t) => t + 1);
    refreshIndicators();
  };

  const confirmRevoke = async (motivo?: string) => {
    if (!revoking) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await loansApi.revoke(revoking.id, motivo);
      showToast({ title: `Préstamo ${result.prestamo.codigoFormateado} revocado`, description: result.message, variant: 'warning' });
      setRevoking(null);
      reloadAll();
    } catch (error) {
      setActionError(describeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const runExpiryControl = async () => {
    setRunningCron(true);
    try {
      setCronSummary(await notificationsApi.runExpiryControl());
      reloadAll();
    } catch (error) {
      showToast({ title: 'No se pudo ejecutar el control de vigencia', description: describeApiError(error), variant: 'error' });
    } finally {
      setRunningCron(false);
    }
  };

  const data = state.status === 'ready' ? state.data : null;
  const metricas = data?.metricas ?? null;
  const loans = data?.items ?? [];
  const isAudit = query.vista === 'auditoria';
  const noFilters = !query.estado && !query.porVencer24h && !query.departamentoId && !query.q;
  const filtered = !noFilters;

  const KPIS = [
    {
      label: 'Préstamos Activos',
      short: 'Activos',
      value: metricas?.activos ?? null,
      bar: 'bg-status-success',
      active: !isAudit && query.estado === 'ACTIVO' && !query.porVencer24h,
      apply: { estado: 'ACTIVO' as EstadoPrestamo, porVencer24h: false },
    },
    {
      label: 'Por Vencer (24h)',
      short: 'Por Vencer',
      value: metricas?.porVencer24h ?? null,
      bar: 'bg-faud-amber',
      active: !isAudit && query.porVencer24h,
      apply: { estado: undefined, porVencer24h: true },
    },
    {
      label: 'Vencidos Hoy',
      short: 'Vencidos',
      value: metricas?.vencidosHoy ?? null,
      bar: 'bg-status-danger',
      hint: metricas ? `${metricas.vencidosTotal} vencidos en total` : undefined,
      active: !isAudit && query.estado === 'VENCIDO',
      apply: { estado: 'VENCIDO' as EstadoPrestamo, porVencer24h: false },
    },
    {
      label: 'Revocados',
      short: 'Revocados',
      value: metricas?.revocadosTotal ?? null,
      bar: 'bg-faud-dark',
      active: !isAudit && query.estado === 'REVOCADO',
      apply: { estado: 'REVOCADO' as EstadoPrestamo, porVencer24h: false },
    },
    {
      label: 'Total Histórico',
      short: 'Total',
      value: metricas?.totalHistorico ?? null,
      bar: 'bg-faud-border-warm',
      hint: metricas ? `${metricas.cerradosTotal} cerrados` : undefined,
      active: !isAudit && noFilters,
      apply: { estado: undefined, porVencer24h: false, departamentoId: undefined, q: undefined },
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Préstamos"
        subtitle="Gestioná los accesos temporales al material digital."
        mobileSubtitle="Gestioná los accesos temporales."
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="lg:h-11 lg:px-5 lg:text-body"
            leftIcon={<CalendarClock className="w-4 h-4" />}
            isLoading={runningCron}
            onClick={runExpiryControl}
          >
            Ejecutar control de vigencia
          </Button>
        }
      />

      {/* KPIs: cada tarjeta aplica su filtro sobre la tabla */}
      <div className="-mx-5 px-5 lg:mx-0 lg:px-0 flex lg:grid lg:grid-cols-5 gap-2.5 lg:gap-5 overflow-x-auto no-scrollbar">
        {KPIS.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            short={kpi.short}
            value={kpi.value}
            bar={kpi.bar}
            hint={kpi.hint}
            active={kpi.active}
            className="shrink-0 w-[98px] lg:w-auto"
            onClick={() => updateQuery({ vista: 'prestamos', ...kpi.apply })}
          />
        ))}
      </div>

      <div role="tablist" aria-label="Vista" className="mt-6 flex gap-2">
        <TabPill active={!isAudit} onClick={() => setSearchParams(new URLSearchParams())}>
          Préstamos{data && ` (${data.meta.total})`}
        </TabPill>
        <TabPill active={isAudit} onClick={() => setSearchParams(writeAdminLoansParams({ ...query, vista: 'auditoria', tipo: undefined, leida: undefined, page: 1 }))}>
          Auditoría de notificaciones
        </TabPill>
      </div>

      {isAudit ? (
        <NotificationsAuditPanel
          params={toAdminAuditApiParams(query)}
          version={reloadToken}
          onFiltersChange={(patch) => updateQuery({ ...patch, page: patch.page ?? 1 })}
        />
      ) : (
        <>
          {/* Filtros: búsqueda libre, estado y departamento del titular */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_240px] gap-3">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search className="w-4 h-4 text-faud-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <TextField
                type="search"
                aria-label="Buscar préstamos"
                placeholder="Buscar por titular, obra o código (#1024)"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="pl-10"
              />
            </div>
            <SelectField
              aria-label="Estado del préstamo"
              placeholder="Todos los estados"
              options={ESTADOS_PRESTAMO.map((estado) => ({ value: estado, label: ESTADO_LABEL[estado] }))}
              value={query.estado ?? ''}
              onChange={(e) => updateQuery({ estado: (e.target.value || undefined) as EstadoPrestamo | undefined })}
            />
            <SelectField
              aria-label="Departamento del titular"
              placeholder={departments.status === 'loading' ? 'Cargando departamentos…' : 'Todos los departamentos'}
              options={departments.options}
              value={query.departamentoId ?? ''}
              onChange={(e) => updateQuery({ departamentoId: e.target.value || undefined })}
            />
          </div>
          {query.porVencer24h && (
            <div className="mt-3">
              <KeywordTag size="sm" onRemove={() => updateQuery({ porVencer24h: false })}>
                Vencen en las próximas 24 h
              </KeywordTag>
            </div>
          )}

          {state.status === 'loading' && (
            <div role="status" className="mt-5 space-y-3 animate-pulse">
              <span className="sr-only">Cargando préstamos…</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-card bg-white border border-faud-border-warm" />
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <div className="mt-5">
              <Alert variant="danger" title="No pudimos cargar los préstamos">
                {state.message}
              </Alert>
              <Button
                className="mt-4"
                onClick={() => {
                  setState({ status: 'loading' });
                  setReloadToken((t) => t + 1);
                }}
              >
                Reintentar
              </Button>
            </div>
          )}

          {data && (
            <div aria-busy={refreshing} className={refreshing ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              {/* Desktop: tabla */}
              <div className="hidden lg:block mt-5 bg-white rounded-card border border-faud-border-warm overflow-hidden">
                <table className="w-full text-left table-fixed">
                  <thead className="table-head">
                    <tr className="h-[50px] border-b border-faud-border-warm">
                      <th className="pl-6 w-[9%] font-bold">Código</th>
                      <th className="w-[30%] font-bold">Documento</th>
                      <th className="w-[21%] font-bold">Titular</th>
                      <th className="w-[16%] font-bold">Vence</th>
                      <th className="w-[11%] font-bold">Estado</th>
                      <th className="font-bold">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan, index) => {
                      const status = getAdminLoanStatus(loan, now);
                      return (
                        <tr key={loan.id} className={`h-20 ${index > 0 ? 'border-t border-dashed border-faud-border-warm' : ''}`}>
                          <td className="pl-6 text-body font-bold text-faud-ink">{loan.codigoFormateado}</td>
                          <td className="pr-4">
                            <div className="flex items-center gap-4">
                              <DocThumb folded={index === 0} />
                              <span className="text-body font-bold text-faud-text truncate" title={loan.documento.titulo}>
                                {loan.documento.titulo}
                              </span>
                            </div>
                          </td>
                          <td className="pr-3 text-body">
                            <p className="text-faud-text truncate">{loan.usuario.nombre}</p>
                            <p className="text-caption text-faud-muted">{loan.usuario.departamento.nombre}</p>
                          </td>
                          <td className="pr-3" title={formatDateTime(loan.fechaVencimiento)}>
                            <p className={`text-body ${status.urgent ? 'text-status-danger font-bold' : 'text-faud-text'}`}>
                              {formatDate(loan.fechaVencimiento)}
                            </p>
                            <p className="text-caption text-faud-muted">{status.remaining}</p>
                          </td>
                          <td>
                            <Badge variant={status.variant} dot shape="square" className="min-w-[70px]">
                              {status.label}
                            </Badge>
                          </td>
                          <td className="pr-4">
                            {status.revocable ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setRevoking(loan);
                                }}
                                className={`${revokeClass} h-9 px-3 text-caption`}
                                aria-label={`Revocar acceso del préstamo ${loan.codigoFormateado}`}
                              >
                                Revocar acceso
                              </button>
                            ) : (
                              <span className="text-caption text-faud-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {loans.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-body text-faud-muted">
                          {filtered ? 'Ningún préstamo coincide con los filtros aplicados.' : 'Todavía no se registraron préstamos.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="h-3" />
              </div>

              {/* Mobile: tarjetas */}
              <div className="lg:hidden mt-4 space-y-3">
                {loans.map((loan, index) => {
                  const status = getAdminLoanStatus(loan, now);
                  return (
                    <article key={loan.id} className="bg-white rounded-card border border-faud-border-warm p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={status.variant} dot shape="square" size="xs">
                          {status.label}
                        </Badge>
                        <span className={`text-[10px] font-bold ${status.urgent ? 'text-status-danger' : 'text-faud-ink'}`}>
                          {loan.codigoFormateado} · Vence: {formatDate(loan.fechaVencimiento)}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2.5">
                        <DocThumb folded={index === 0} />
                        <div className="min-w-0">
                          <p className="text-caption font-bold text-faud-ink truncate">{loan.documento.titulo}</p>
                          <p className="text-[10px] text-faud-muted">
                            {loan.usuario.nombre} ({loan.usuario.departamento.nombre})
                          </p>
                          <p className="text-[10px] text-faud-muted">{status.remaining}</p>
                        </div>
                      </div>
                      {status.revocable && (
                        <div className="mt-4 pt-2.5 border-t border-dashed border-faud-border-warm">
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setRevoking(loan);
                            }}
                            className={`${revokeClass} w-full h-8 text-caption`}
                          >
                            Revocar préstamo
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {loans.length === 0 && (
                  <p className="bg-white rounded-card border border-faud-border-warm p-6 text-center text-caption text-faud-muted">
                    {filtered ? 'Ningún préstamo coincide con los filtros aplicados.' : 'Todavía no se registraron préstamos.'}
                  </p>
                )}
              </div>

              <Pagination
                className="mt-6"
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={(page) => updateQuery({ page })}
              />
            </div>
          )}

          <p className="hidden lg:flex items-center gap-2 mt-4 text-body text-faud-muted">
            <InfoDot />
            Revocar un préstamo retira inmediatamente el acceso digital al documento para el usuario en cuestión.
          </p>
        </>
      )}

      <AdminActionModal
        open={revoking !== null}
        title="Revocar acceso"
        icon={<ShieldOff className="w-6 h-6 text-status-danger" />}
        confirmLabel="Revocar acceso"
        confirmVariant="danger"
        motivo="required"
        motivoLabel="Motivo administrativo *"
        motivoPlaceholder="Ej: Actualización de la versión del documento en archivo de Biblioteca."
        submitting={submitting}
        error={actionError}
        onConfirm={confirmRevoke}
        onClose={() => setRevoking(null)}
      >
        {revoking && (
          <>
            <p className="font-bold text-faud-ink">
              Préstamo {revoking.codigoFormateado} · {revoking.documento.titulo}
            </p>
            <p className="text-faud-muted">
              {revoking.usuario.nombre} ({revoking.usuario.departamento.nombre}) · vence{' '}
              {formatDateTime(revoking.fechaVencimiento)}
            </p>
            <p>
              El visor protegido del usuario se bloqueará en el acto y recibirá el aviso{' '}
              <span className="font-bold">Préstamo revocado</span> con este motivo. La acción no se puede deshacer.
            </p>
          </>
        )}
      </AdminActionModal>

      <CronSummaryModal summary={cronSummary} onClose={() => setCronSummary(null)} />
    </>
  );
};
