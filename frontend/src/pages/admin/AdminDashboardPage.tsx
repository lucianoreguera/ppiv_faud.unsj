import React from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, FilePlus2, UserCheck } from 'lucide-react';
import { KpiCard } from '../../components/admin/KpiCard';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Alert } from '../../components/ui/Alert';
import { buttonClasses } from '../../components/ui/Button';
import { useAdminPanel } from '../../hooks/useAdminIndicators';
import { useNow } from '../../hooks/useNow';
import { useTerritorialMetrics } from '../../hooks/useTerritorialMetrics';
import { formatDate, formatRemaining, getRemainingTime } from '../../utils/loan-time';

/**
 * Panel de Biblioteca (`/admin`): resumen operativo con accesos directos.
 * GET /api/v1/usuarios?estado=PENDIENTE · GET /api/v1/prestamos?porVencer24h=true · GET /api/v1/departamentos/metricas
 * (no forma parte de los prototipos Figma; reutiliza las tarjetas de la pág. 9).
 */
const Panel: React.FC<{ title: string; icon: React.ReactNode; to: string; linkLabel: string; children: React.ReactNode }> = ({
  title,
  icon,
  to,
  linkLabel,
  children,
}) => (
  <section aria-label={title} className="bg-white rounded-card border border-faud-border-warm">
    <header className="flex items-center gap-2.5 px-5 lg:px-6 pt-5 pb-4 border-b border-faud-border-warm">
      {icon}
      <h2 className="flex-1 text-[16px] font-bold text-faud-ink">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-1 text-caption font-bold text-faud-gold-dark hover:text-faud-ink">
        {linkLabel}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </header>
    {children}
  </section>
);

export const AdminDashboardPage: React.FC = () => {
  const { indicators } = useAdminPanel();
  const metrics = useTerritorialMetrics();
  const now = useNow();
  const { usuarios, prestamos, pendientes, porVencer } = indicators;
  const loading = indicators.status === 'loading';

  return (
    <>
      <AdminPageHeader
        title="Panel"
        subtitle="Resumen operativo de Biblioteca FAUD-UNSJ."
        actions={
          <Link to="/admin/catalogo/nuevo" className={buttonClasses('primary', 'md', 'rounded-[4px]')}>
            <FilePlus2 className="w-4 h-4" aria-hidden="true" />
            Cargar documento
          </Link>
        }
      />

      {indicators.status === 'error' && (
        <Alert variant="danger" title="No pudimos cargar los indicadores" className="mb-5">
          Verificá la conexión con el Backend y volvé a intentar.
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-5">
        <KpiCard
          label="Cuentas pendientes"
          value={usuarios?.pendientes ?? null}
          bar="bg-faud-amber"
          hint={usuarios ? `${usuarios.aprobados} aprobadas · ${usuarios.rechazados} rechazadas` : undefined}
          to="/admin/usuarios"
        />
        <KpiCard
          label="Préstamos activos"
          value={prestamos?.activos ?? null}
          bar="bg-status-success"
          hint={prestamos ? `${prestamos.totalHistorico} en total` : undefined}
          to="/admin/prestamos?estado=ACTIVO"
        />
        <KpiCard
          label="Por vencer (24h)"
          value={prestamos?.porVencer24h ?? null}
          bar="bg-status-danger"
          hint={prestamos ? `${prestamos.vencidosHoy} vencidos hoy` : undefined}
          to="/admin/prestamos?porVencer=1"
        />
        <KpiCard
          label="Documentos catalogados"
          value={metrics.data?.totalDocumentosCatalogados ?? null}
          bar="bg-faud-dark"
          hint={metrics.data ? `${metrics.data.totalUsuariosProvincia} usuarios en ${metrics.data.totalDepartamentos} departamentos` : undefined}
          to="/admin/catalogo"
        />
      </div>

      <div className="mt-5 lg:mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel
          title="Cuentas por validar"
          icon={<UserCheck className="w-5 h-5 text-faud-gold-dark" aria-hidden="true" />}
          to="/admin/usuarios"
          linkLabel="Validar cuentas"
        >
          {loading ? (
            <div className="h-32 animate-pulse" />
          ) : pendientes.length === 0 ? (
            <p className="px-6 py-8 text-center text-body text-faud-muted">No hay cuentas pendientes de validación.</p>
          ) : (
            <ul className="divide-y divide-dashed divide-faud-border-warm">
              {pendientes.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 lg:px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-bold text-faud-ink truncate">{u.nombre}</p>
                    <p className="text-caption text-faud-muted truncate">{u.email}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-[4px] bg-faud-amber-light text-status-warning text-[11px] font-bold">
                    {u.departamento.nombre}
                  </span>
                  <span className="hidden sm:inline shrink-0 text-caption text-faud-muted">{formatDate(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Préstamos por vencer en 24 h"
          icon={<AlarmClock className="w-5 h-5 text-status-danger" aria-hidden="true" />}
          to="/admin/prestamos?porVencer=1"
          linkLabel="Ver préstamos"
        >
          {loading ? (
            <div className="h-32 animate-pulse" />
          ) : porVencer.length === 0 ? (
            <p className="px-6 py-8 text-center text-body text-faud-muted">Ningún préstamo vence en las próximas 24 horas.</p>
          ) : (
            <ul className="divide-y divide-dashed divide-faud-border-warm">
              {porVencer.map((loan) => (
                <li key={loan.id} className="flex items-center gap-3 px-5 lg:px-6 py-3">
                  <span className="shrink-0 text-body font-bold text-faud-ink">{loan.codigoFormateado}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-faud-ink truncate">{loan.documento.titulo}</p>
                    <p className="text-caption text-faud-muted truncate">
                      {loan.usuario.nombre} ({loan.usuario.departamento.nombre})
                    </p>
                  </div>
                  <span className="shrink-0 text-caption font-bold text-status-danger">
                    {formatRemaining(getRemainingTime(loan.fechaVencimiento, now))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
};
