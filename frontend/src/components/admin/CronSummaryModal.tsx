import React from 'react';
import { CalendarClock, MailCheck, MailX } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { formatDateTime } from '../../utils/loan-time';
import type { CronExecutionSummaryResponseDto, CronProcessedLoanItemDto } from '../../types/openapi.types';

/**
 * Resultado de POST /api/v1/notificaciones/ejecutar-control-vigencia (Diagrama de Actividades, Figura 4):
 * préstamos que pasaron de ACTIVO a VENCIDO, recordatorios de 24h generados y correos despachados (Mailpit).
 */
const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-[8px] border border-faud-border-warm bg-faud-cream px-3 py-2.5">
    <p className="text-[22px] font-bold text-faud-ink leading-tight">{value}</p>
    <p className="text-caption text-faud-muted">{label}</p>
  </div>
);

const DetailList: React.FC<{ title: string; items: CronProcessedLoanItemDto[]; empty: string }> = ({
  title,
  items,
  empty,
}) => (
  <section aria-label={title}>
    <h3 className="text-[15px] font-bold text-faud-ink">{title}</h3>
    {items.length === 0 ? (
      <p className="mt-1 text-caption text-faud-muted">{empty}</p>
    ) : (
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.notificacionId} className="rounded-[8px] border border-faud-border-warm px-3 py-2">
            <p className="text-body text-faud-ink">
              <span className="font-bold">{item.codigoFormateado}</span> · {item.documentoTitulo}
            </p>
            <p className="text-caption text-faud-muted">
              {item.usuarioNombre} ({item.departamentoNombre}) · vence {formatDateTime(item.fechaVencimiento)}
            </p>
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-caption font-bold ${
                item.correoEnviado ? 'text-status-success' : 'text-status-danger'
              }`}
            >
              {item.correoEnviado ? (
                <MailCheck className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <MailX className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {item.correoEnviado ? `Correo enviado a ${item.usuarioEmail}` : `Correo no enviado a ${item.usuarioEmail}`}
            </p>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const CronSummaryModal: React.FC<{
  summary: CronExecutionSummaryResponseDto | null;
  onClose: () => void;
}> = ({ summary, onClose }) => (
  <Modal
    open={summary !== null}
    title="Control de vigencia ejecutado"
    icon={<CalendarClock className="w-6 h-6 text-faud-gold-dark" />}
    onClose={onClose}
    footer={<Button onClick={onClose}>Entendido</Button>}
  >
    {summary && (
      <div className="space-y-4">
        <p>
          {summary.message}
          <span className="block text-caption text-faud-muted mt-0.5">{formatDateTime(summary.timestamp)}</span>
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Préstamos vencidos" value={summary.prestamosVencidosProcesados} />
          <Stat label="Alertas 24 h" value={summary.alertas24hGeneradas} />
          <Stat label="Correos enviados" value={summary.correosEnviados} />
        </div>
        <DetailList
          title="Pasaron a VENCIDO"
          items={summary.detalleVencidos}
          empty="Ningún préstamo cumplió su plazo de 7 días desde la última ejecución."
        />
        <DetailList
          title="Recordatorios de vencimiento (24 h)"
          items={summary.detalleAlertas24h}
          empty="No hay préstamos nuevos dentro de las últimas 24 horas de vigencia."
        />
      </div>
    )}
  </Modal>
);
