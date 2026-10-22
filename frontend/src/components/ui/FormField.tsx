import React, { useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';

/**
 * Campos de entrada del Design System (Figma pág. 23)
 * Default: borde #E8DCC8 · r:8 · h:44 — Focus: borde #FFB606 · stroke 2 — Dropdown: mismo estilo + chevron
 * Error: borde #B3261E + mensaje debajo del campo (validación de formularios, Fase 1)
 */

interface FieldShellProps {
  id: string;
  label?: string;
  /** Label en peso regular (formulario de carga del panel admin, Figma pág. 7) */
  plainLabel?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

const errorId = (fieldId: string) => `${fieldId}-error`;

const FieldShell: React.FC<FieldShellProps> = ({ id, label, plainLabel, error, className = '', children }) => (
  <div className={className}>
    {label && (
      <label
        htmlFor={id}
        className={plainLabel ? 'block text-body text-faud-text mb-1.5' : 'field-label'}
      >
        {label}
      </label>
    )}
    {children}
    {error && (
      <p id={errorId(id)} className="mt-1.5 text-caption text-status-danger">
        {error}
      </p>
    )}
  </div>
);

const errorProps = (fieldId: string, error?: string) =>
  error
    ? { 'aria-invalid': true as const, 'aria-describedby': errorId(fieldId) }
    : {};

const errorClass = (error?: string) =>
  error ? '!border-status-danger focus:!ring-status-danger' : '';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  plainLabel?: boolean;
  wrapperClassName?: string;
  error?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  error,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} error={error} className={wrapperClassName}>
      <input
        id={fieldId}
        className={`field-input ${errorClass(error)} ${className}`}
        {...errorProps(fieldId, error)}
        {...props}
      />
    </FieldShell>
  );
};

export interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  plainLabel?: boolean;
  wrapperClassName?: string;
  error?: string;
  /** Texto de ayuda bajo el campo (se oculta mientras haya error) */
  hint?: string;
}

/** Área de texto con el estilo de `.field-input` (resumen del documento, motivos administrativos) */
export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  error,
  hint,
  id,
  rows = 4,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} error={error} className={wrapperClassName}>
      <textarea
        id={fieldId}
        rows={rows}
        className={`field-input h-auto py-2.5 leading-relaxed resize-y ${errorClass(error)} ${className}`}
        {...errorProps(fieldId, error)}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-caption text-faud-muted">{hint}</p>}
    </FieldShell>
  );
};

export const PasswordField: React.FC<Omit<TextFieldProps, 'type'>> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  error,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} error={error} className={wrapperClassName}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className={`field-input pr-12 ${errorClass(error)} ${className}`}
          {...errorProps(fieldId, error)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-faud-muted hover:text-faud-text"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </FieldShell>
  );
};

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  plainLabel?: boolean;
  wrapperClassName?: string;
  placeholder?: string;
  error?: string;
  /** Texto plano (value = label) u opciones { value, label } (p. ej. UUID de departamento) */
  options: readonly (string | SelectOption)[];
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  placeholder,
  error,
  options,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} error={error} className={wrapperClassName}>
      <div className="relative">
        <select
          id={fieldId}
          className={`field-input appearance-none pr-10 cursor-pointer ${errorClass(error)} ${className}`}
          {...errorProps(fieldId, error)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const { value, label: optionLabel } = typeof opt === 'string' ? { value: opt, label: opt } : opt;
            return (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <ChevronDown className="w-5 h-5 text-faud-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </FieldShell>
  );
};
