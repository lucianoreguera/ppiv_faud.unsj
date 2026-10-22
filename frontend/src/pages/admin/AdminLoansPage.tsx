import React, { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { InfoDot } from '../../components/ui/Decorations';
import { useToast } from '../../context/ToastContext';
import { ADMIN_LOAN_KPIS, ADMIN_LOANS, type AdminLoanFixture } from '../../mocks/figma-fixtures';

/** Control de préstamos (Figma págs. 9 y 17) — Fase 5 lo conecta con GET /api/v1/prestamos y PATCH .../revocar */
const ESTADO: Record<AdminLoanFixture['estado'], { variant: BadgeVariant; label: string }> = {
  ALERTA: { variant: 'alert', label: 'Alerta' },
  ACTIVO: { variant: 'success', label: 'Activo' },
  VENCIDO: { variant: 'danger', label: 'Vencido' },
};

const KPIS = [
  { label: 'Préstamos Activos', short: 'Activos', value: ADMIN_LOAN_KPIS.activos, bar: 'bg-status-success' },
  { label: 'Por Vencer (24h)', short: 'Por Vencer', value: ADMIN_LOAN_KPIS.porVencer, bar: 'bg-faud-amber' },
  { label: 'Vencidos Hoy', short: 'Vencidos', value: ADMIN_LOAN_KPIS.vencidosHoy, bar: 'bg-status-danger' },
];

/** Miniatura de documento (hoja con esquina plegada) */
const DocThumb: React.FC<{ folded?: boolean }> = ({ folded }) => (
  <span className="relative inline-block w-[30px] h-10 shrink-0 bg-faud-cream border border-faud-border-warm">
    {folded && (
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full" viewBox="0 0 30 40" fill="none">
        <path d="M2 2l12 12M14 2l14 14" stroke="#E8DCC8" />
      </svg>
    )}
  </span>
);

const revokeClass =
  'inline-flex items-center justify-center rounded-[4px] bg-white border border-status-danger text-status-danger font-bold hover:bg-status-danger-bg transition-colors';

export const AdminLoansPage: React.FC = () => {
  const { showToast } = useToast();
  const [loans, setLoans] = useState<AdminLoanFixture[]>(ADMIN_LOANS);

  const revoke = (loan: AdminLoanFixture) => {
    setLoans((prev) => prev.filter((l) => l.id !== loan.id));
    showToast({
      title: 'Préstamo revocado (vista de ejemplo)',
      description: `${loan.documento} · ${loan.usuario}. Fase 5: PATCH /api/v1/prestamos/:id/revocar.`,
      variant: 'warning',
    });
  };

  return (
    <>
      <AdminPageHeader
        title="Préstamos"
        subtitle="Gestioná los accesos temporales al material digital."
        mobileSubtitle="Gestioná los accesos temporales."
      />

      {/* KPIs */}
      <div className="-mx-5 px-5 lg:mx-0 lg:px-0 flex lg:grid lg:grid-cols-3 gap-2.5 lg:gap-7 overflow-x-auto no-scrollbar">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="relative shrink-0 w-[98px] lg:w-auto bg-white rounded-[4px] lg:rounded-card border border-faud-border-warm overflow-hidden px-2.5 pt-3.5 pb-2.5 lg:px-6 lg:pt-8 lg:pb-6"
          >
            <span className={`absolute inset-x-0 top-0 h-[3px] lg:h-1 ${kpi.bar}`} />
            <p className="text-[9px] lg:text-body text-faud-muted">
              <span className="lg:hidden">{kpi.short}</span>
              <span className="hidden lg:inline">{kpi.label}</span>
            </p>
            <p className="text-[18px] lg:text-[32px] font-bold text-faud-ink leading-tight mt-1 lg:mt-0">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden lg:block mt-7 bg-white rounded-card border border-faud-border-warm overflow-hidden">
        <table className="w-full text-left table-fixed">
          <thead className="table-head">
            <tr className="h-[50px] border-b border-faud-border-warm">
              <th className="pl-10 w-[35%] font-bold">Documento</th>
              <th className="w-[22%] font-bold">Usuario</th>
              <th className="w-[15%] font-bold">Vence</th>
              <th className="w-[15%] font-bold">Estado</th>
              <th className="font-bold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan, index) => {
              const estado = ESTADO[loan.estado];
              return (
                <tr key={loan.id} className={`h-20 ${index > 0 ? 'border-t border-dashed border-faud-border-warm' : ''}`}>
                  <td className="pl-10 pr-4">
                    <div className="flex items-start gap-4">
                      <DocThumb folded={index === 0} />
                      <span className="pt-1 max-w-[185px] text-body font-bold text-faud-text truncate" title={loan.documento}>
                        {loan.documento}
                      </span>
                    </div>
                  </td>
                  <td className="text-body text-faud-muted align-top pt-[22px]">{loan.usuario}</td>
                  <td
                    className={`text-body align-top pt-[22px] ${
                      loan.vence === 'Hoy' ? 'text-status-danger font-bold' : 'text-faud-text'
                    }`}
                  >
                    {loan.vence}
                  </td>
                  <td>
                    <Badge variant={estado.variant} dot shape="square" className="min-w-[70px]">
                      {estado.label}
                    </Badge>
                  </td>
                  <td>
                    <button type="button" onClick={() => revoke(loan)} className={`${revokeClass} h-9 w-[100px] text-caption`}>
                      Revocar
                    </button>
                  </td>
                </tr>
              );
            })}
            {loans.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-body text-faud-muted">
                  No hay préstamos activos para mostrar.
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
          const estado = ESTADO[loan.estado];
          return (
            <article key={loan.id} className="bg-white rounded-card border border-faud-border-warm p-2.5">
              <div className="flex items-center justify-between">
                <Badge variant={estado.variant} dot shape="square" size="xs">
                  {estado.label}
                </Badge>
                <span
                  className={`text-[10px] font-bold ${loan.vence === 'Hoy' ? 'text-status-danger' : 'text-faud-ink'}`}
                >
                  Vence: {loan.venceCorto}
                </span>
              </div>
              <div className="mt-3 flex gap-2.5">
                <DocThumb folded={index === 0} />
                <div className="min-w-0">
                  <p className="text-caption font-bold text-faud-ink truncate">{loan.documentoCorto}</p>
                  <p className="text-[10px] text-faud-muted">{loan.usuario}</p>
                </div>
              </div>
              <div className="mt-4 pt-2.5 border-t border-dashed border-faud-border-warm">
                <button type="button" onClick={() => revoke(loan)} className={`${revokeClass} w-full h-8 text-caption`}>
                  Revocar préstamo
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="hidden lg:flex items-center gap-2 mt-4 text-body text-faud-muted">
        <InfoDot />
        Revocar un préstamo retira inmediatamente el acceso digital al documento para el usuario en cuestión.
      </p>
    </>
  );
};
