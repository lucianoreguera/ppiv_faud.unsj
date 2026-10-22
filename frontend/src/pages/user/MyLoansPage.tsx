import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, type BadgeVariant, TabPill } from '../../components/ui/Badge';
import { InfoDot } from '../../components/ui/Decorations';
import { MY_LOANS, type MyLoanFixture, type MyLoanTab } from '../../mocks/figma-fixtures';

/** Mis préstamos (Figma págs. 13 y 19) — Fase 3 lo conecta con GET /api/v1/prestamos/mis-prestamos */
const STATUS: Record<MyLoanFixture['estado'], { variant: BadgeVariant; label: (l: MyLoanFixture) => string; bar: string }> = {
  ACTIVO: { variant: 'success', label: (l) => `Activo · ${l.diasRestantes} días`, bar: 'bg-status-success' },
  POR_VENCER: { variant: 'warning', label: (l) => `Por vencer · ${l.diasRestantes} día`, bar: 'bg-status-warning' },
  VENCIDO: { variant: 'inactive', label: () => 'Vencido', bar: 'bg-status-disabled' },
  SOLICITADO: { variant: 'warning', label: () => 'Solicitado', bar: 'bg-faud-amber' },
};

const TABS: { id: MyLoanTab; label: string; count: number }[] = [
  { id: 'activos', label: 'Activos', count: MY_LOANS.filter((l) => l.estado === 'ACTIVO' || l.estado === 'POR_VENCER').length },
  { id: 'vencidos', label: 'Vencidos', count: MY_LOANS.filter((l) => l.estado === 'VENCIDO').length },
  { id: 'solicitados', label: 'Solicitados', count: MY_LOANS.filter((l) => l.estado === 'SOLICITADO').length },
];

const readButtonClass =
  'inline-flex items-center justify-center rounded-[4px] font-bold transition-colors bg-faud-amber text-faud-ink hover:bg-faud-gold-hover disabled:bg-status-inactive-bg disabled:text-status-disabled disabled:cursor-not-allowed';

export const MyLoansPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MyLoanTab>('activos');

  // En el prototipo, la pestaña "Activos" muestra también el historial reciente (vencidos atenuados).
  const loans =
    tab === 'activos'
      ? MY_LOANS
      : MY_LOANS.filter((l) => (tab === 'vencidos' ? l.estado === 'VENCIDO' : l.estado === 'SOLICITADO'));

  const openViewer = (loan: MyLoanFixture) => navigate(`/visor/${loan.id}`);

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

        <div role="tablist" className="mt-3 lg:mt-4 flex gap-2 lg:gap-2.5 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <TabPill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
              <span className={t.id === 'solicitados' ? 'hidden lg:inline' : ''}>&nbsp;({t.count})</span>
            </TabPill>
          ))}
        </div>

        {/* Desktop: tabla (Figma pág. 13) */}
        <div className="hidden lg:block mt-8 bg-white rounded-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="table-head">
              <tr className="h-[48px]">
                <th className="pl-8 font-bold">Documento</th>
                <th className="w-[150px] font-bold">Inicio</th>
                <th className="w-[150px] font-bold">Vence</th>
                <th className="w-[200px] font-bold">Estado</th>
                <th className="w-[240px] font-bold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const status = STATUS[loan.estado];
                const expired = loan.estado === 'VENCIDO';
                return (
                  <tr key={loan.id} className="h-20 border-t border-faud-border-warm">
                    <td className="pl-8">
                      <p className={`text-[15px] font-bold ${expired ? 'text-faud-muted' : 'text-faud-ink'}`}>{loan.titulo}</p>
                      <p className="text-caption text-faud-muted mt-0.5">{loan.autor}</p>
                    </td>
                    <td className={`text-body ${expired ? 'text-faud-muted' : 'text-faud-text'}`}>{loan.inicio}</td>
                    <td className={`text-body ${expired ? 'text-faud-muted' : 'text-faud-text'}`}>{loan.vence}</td>
                    <td>
                      <Badge variant={status.variant} className={loan.estado === 'POR_VENCER' ? 'min-w-[140px]' : ''}>
                        {status.label(loan)}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={expired}
                        onClick={() => openViewer(loan)}
                        className={`${readButtonClass} h-8 w-[140px] text-caption`}
                      >
                        Leer documento
                      </button>
                    </td>
                  </tr>
                );
              })}
              {loans.length === 0 && (
                <tr className="border-t border-faud-border-warm">
                  <td colSpan={5} className="py-10 text-center text-body text-faud-muted">
                    No tenés préstamos en esta sección.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="h-5" />
        </div>

        {/* Mobile: tarjetas con barra superior de estado (Figma pág. 19) */}
        <div className="lg:hidden mt-5 space-y-4">
          {loans.map((loan) => {
            const status = STATUS[loan.estado];
            const expired = loan.estado === 'VENCIDO';
            return (
              <article key={loan.id} className={`overflow-hidden rounded-[4px] ${expired ? 'bg-white/60' : 'bg-white'}`}>
                <div className={`h-[3px] ${status.bar}`} />
                <div className="p-3">
                  <Badge variant={status.variant} size="xs">
                    {status.label(loan)}
                  </Badge>
                  <h2 className={`mt-1.5 text-body font-bold truncate ${expired ? 'text-faud-muted' : 'text-faud-ink'}`}>
                    {loan.titulo}
                  </h2>
                  <p className="text-[11px] text-faud-muted">{loan.autor}</p>
                  <p className={`text-[11px] mt-1 ${expired ? 'text-faud-muted' : 'text-faud-text'}`}>
                    Inicia: {loan.inicio} · Vence: {loan.vence}
                  </p>
                  <button
                    type="button"
                    disabled={expired}
                    onClick={() => openViewer(loan)}
                    className={`${readButtonClass} mt-3 w-full h-8 text-caption`}
                  >
                    Leer documento
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Recordatorio automático (RF06) */}
        <div className="mt-4 lg:mt-10 flex items-start lg:items-center gap-3 lg:gap-4 rounded-input border border-faud-amber bg-faud-amber-light px-3 lg:px-7 py-3 lg:py-6 text-caption lg:text-body">
          <InfoDot tone="amber" className="mt-0.5 lg:mt-0" />
          <p className="text-faud-ink">
            <strong className="text-status-warning">Recordatorio automático:</strong>
            <span className="hidden lg:inline">Recibirás un correo electrónico 24 horas antes de que venza un préstamo.</span>
            <span className="lg:hidden">
              <br />
              Correo 24h antes del vencimiento.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
