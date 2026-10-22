import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, CalendarClock, CheckCircle2, KeyRound, Lock, Stamp } from 'lucide-react';
import { loansApi } from '../../api/loans.api';
import { ApiHttpError, setDrmToken } from '../../api/http-client';
import { Alert } from '../ui/Alert';
import { Button, buttonClasses } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { formatDateTime } from '../../utils/loan-time';
import type { CreateLoanResponseDto, DocumentItemDto } from '../../types/openapi.types';

/**
 * Confirmación de la solicitud de préstamo digital (Spec FE-03, regla 1 · RF03).
 * POST /api/v1/prestamos { documentoId } → 201 con el préstamo ACTIVO, el tokenAcceso DRM de 7 días y la marca de agua.
 * El token queda guardado por préstamo (`faud_drm_tokens`) para que el Visor Protegido lo envíe en `x-drm-token`.
 */
const LOAN_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ModalState =
  | { step: 'confirm'; error?: RequestError }
  | { step: 'submitting' }
  | { step: 'granted'; response: CreateLoanResponseDto };

interface RequestError {
  title: string;
  message: string;
  /**
   * - already-active: 409 por préstamo ACTIVO duplicado → se ofrece ir a "Mis préstamos"
   * - unavailable:    409 por obra suspendida o 404 → no tiene sentido reintentar
   * - retry:          403, red o servidor → se puede volver a confirmar
   */
  kind: 'already-active' | 'unavailable' | 'retry';
}

function describeError(error: unknown): RequestError {
  if (!(error instanceof ApiHttpError)) {
    return { title: 'No pudimos solicitar el préstamo', message: 'Intentá nuevamente en unos instantes.', kind: 'retry' };
  }
  if (error.status === 409) {
    return /ya posees/i.test(error.message)
      ? { title: 'Ya tenés un préstamo activo de esta obra', message: error.message, kind: 'already-active' }
      : { title: 'Material no disponible', message: error.message, kind: 'unavailable' };
  }
  if (error.status === 404) {
    return {
      title: 'Documento no encontrado',
      message: 'La obra fue retirada del catálogo por la Biblioteca FAUD-UNSJ.',
      kind: 'unavailable',
    };
  }
  if (error.status === 403) return { title: 'Tu cuenta no puede solicitar préstamos', message: error.message, kind: 'retry' };
  if (error.code === 'NETWORK_ERROR') {
    return {
      title: 'Sin conexión con el Repositorio FAUD',
      message: 'Verificá tu conexión e intentá nuevamente.',
      kind: 'retry',
    };
  }
  return { title: 'No pudimos solicitar el préstamo', message: error.message, kind: 'retry' };
}

const Condition: React.FC<{ icon: React.ElementType; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <li className="flex items-start gap-2.5">
    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-faud-gold-dark" aria-hidden="true" />
    <span>{children}</span>
  </li>
);

export interface RequestLoanModalProps {
  open: boolean;
  documento: DocumentItemDto;
  userName: string;
  onClose: () => void;
  onGranted: (response: CreateLoanResponseDto) => void;
  /** 409 / 404: la ficha vuelve a consultar el documento y los préstamos del usuario */
  onRejected: () => void;
}

export const RequestLoanModal: React.FC<RequestLoanModalProps> = ({
  open,
  documento,
  userName,
  onClose,
  onGranted,
  onRejected,
}) => {
  const [state, setState] = useState<ModalState>({ step: 'confirm' });

  useEffect(() => {
    if (open) setState({ step: 'confirm' });
  }, [open]);

  const confirm = async () => {
    setState({ step: 'submitting' });
    try {
      const response = await loansApi.request(documento.id);
      setDrmToken(response.prestamo.id, response.tokenAcceso);
      setState({ step: 'granted', response });
      onGranted(response);
    } catch (error) {
      setState({ step: 'confirm', error: describeError(error) });
      if (error instanceof ApiHttpError && (error.status === 409 || error.status === 404)) onRejected();
    }
  };

  if (state.step === 'granted') {
    const { prestamo, marcaAgua } = state.response;
    // `key` distinta: el diálogo se vuelve a montar y el foco pasa a sus nuevas acciones
    return (
      <Modal
        key="granted"
        open={open}
        onClose={onClose}
        title={`Préstamo ${prestamo.codigoFormateado} otorgado`}
        icon={<CheckCircle2 className="w-6 h-6 text-status-success" />}
        footer={
          <>
            <Link to="/mis-prestamos" className={buttonClasses('secondary', 'md')}>
              Ir a Mis préstamos
            </Link>
            <Link to={`/visor/${prestamo.id}`} className={buttonClasses('primary', 'md')}>
              <BookOpenCheck className="w-4 h-4" />
              Abrir en Visor Protegido
            </Link>
          </>
        }
      >
        <p>
          Ya podés leer <strong className="text-faud-ink">{prestamo.documento.titulo}</strong> durante{' '}
          {state.response.expiresInDays} días corridos.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-input border border-faud-border-warm bg-faud-cream px-4 py-3">
          <div>
            <dt className="text-caption font-bold text-faud-muted">Código de préstamo</dt>
            <dd className="text-[16px] font-bold text-faud-ink">{prestamo.codigoFormateado}</dd>
          </div>
          <div>
            <dt className="text-caption font-bold text-faud-muted">Vence</dt>
            <dd className="text-faud-ink">{formatDateTime(prestamo.fechaVencimiento)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-caption font-bold text-faud-muted">Marca de agua en cada página</dt>
            <dd className="text-faud-ink">{marcaAgua}</dd>
          </div>
        </dl>
        <p className="mt-3 text-caption text-faud-muted">
          Te avisaremos por correo y en la campana de notificaciones 24 horas antes del vencimiento.
        </p>
      </Modal>
    );
  }

  const submitting = state.step === 'submitting';
  const error = state.step === 'confirm' ? state.error : undefined;
  const estimatedExpiry = new Date(Date.now() + LOAN_DAYS * MS_PER_DAY);

  return (
    <Modal
      key="confirm"
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title="Confirmar préstamo digital"
      footer={
        <>
          <Button variant="neutral" onClick={onClose} disabled={submitting}>
            {error && error.kind !== 'retry' ? 'Cerrar' : 'Cancelar'}
          </Button>
          {error?.kind === 'already-active' && (
            <Link to="/mis-prestamos" className={buttonClasses('primary', 'md')}>
              Ir a Mis préstamos
            </Link>
          )}
          {(!error || error.kind === 'retry') && (
            <Button onClick={confirm} isLoading={submitting}>
              {submitting ? 'Solicitando…' : 'Confirmar préstamo (7 días)'}
            </Button>
          )}
        </>
      }
    >
      <p>
        Vas a solicitar <strong className="text-faud-ink">{documento.titulo}</strong> de {documento.autor}.
      </p>
      <ul className="mt-4 space-y-2.5">
        <Condition icon={CalendarClock}>
          Acceso de lectura por <strong>{LOAN_DAYS} días corridos</strong>, hasta el{' '}
          <strong>{formatDateTime(estimatedExpiry)}</strong> aproximadamente.
        </Condition>
        <Condition icon={KeyRound}>
          Se genera un token de acceso temporal (DRM) válido solo para este préstamo.
        </Condition>
        <Condition icon={Stamp}>
          Cada página mostrará la marca de agua <strong>“{userName} · Préstamo #…”</strong>.
        </Condition>
        <Condition icon={Lock}>Lectura exclusiva en el Visor Protegido: sin descarga, impresión ni copia.</Condition>
      </ul>
      {error && (
        <Alert variant={error.kind === 'already-active' ? 'warning' : 'danger'} title={error.title} className="mt-4">
          {error.message}
        </Alert>
      )}
    </Modal>
  );
};
