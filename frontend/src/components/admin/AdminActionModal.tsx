import React, { useEffect, useState } from 'react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { TextAreaField } from '../ui/FormField';
import { Modal } from '../ui/Modal';

/**
 * Confirmación de acciones administrativas de Biblioteca (aprobar / rechazar cuentas, revocar préstamos,
 * eliminar documentos). El motivo queda registrado en la auditoría y viaja en el aviso al usuario.
 */
export interface AdminActionModalProps {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  /** 'none' sin campo · 'optional' observación opcional · 'required' motivo obligatorio */
  motivo?: 'none' | 'optional' | 'required';
  motivoLabel?: string;
  motivoPlaceholder?: string;
  submitting?: boolean;
  /** Error del Backend que se muestra dentro del diálogo (p. ej. 409 al eliminar) */
  error?: string | null;
  /** Acción secundaria opcional (p. ej. "Suspender en su lugar" ante un 409) */
  extraAction?: React.ReactNode;
  onConfirm: (motivo?: string) => void;
  onClose: () => void;
}

const MOTIVO_MIN = 5;

export const AdminActionModal: React.FC<AdminActionModalProps> = ({
  open,
  title,
  icon,
  children,
  confirmLabel,
  confirmVariant = 'primary',
  motivo = 'none',
  motivoLabel,
  motivoPlaceholder,
  submitting = false,
  error,
  extraAction,
  onConfirm,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = text.trim();
  const motivoError =
    motivo === 'required' && touched && trimmed.length < MOTIVO_MIN
      ? `Indicá el motivo (al menos ${MOTIVO_MIN} caracteres).`
      : undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (motivo === 'required' && trimmed.length < MOTIVO_MIN) {
      setTouched(true);
      return;
    }
    onConfirm(motivo === 'none' ? undefined : trimmed || undefined);
  };

  const formId = `admin-action-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <Modal
      open={open}
      title={title}
      icon={icon}
      onClose={onClose}
      dismissible={!submitting}
      footer={
        <>
          <Button variant="neutral" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          {extraAction}
          <Button type="submit" form={formId} variant={confirmVariant} isLoading={submitting}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">{children}</div>
        {motivo !== 'none' && (
          <TextAreaField
            plainLabel
            label={motivoLabel ?? (motivo === 'required' ? 'Motivo *' : 'Observación (opcional)')}
            placeholder={motivoPlaceholder}
            value={text}
            maxLength={500}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTouched(true)}
            error={motivoError}
            hint="Queda registrado en la auditoría de Biblioteca."
          />
        )}
        {error && (
          <Alert variant="danger" title="No se pudo completar la acción">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
};
