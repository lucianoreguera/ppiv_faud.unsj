import React, { useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';

/**
 * Campos de entrada del Design System (Figma pág. 23)
 * Default: borde #E8DCC8 · r:8 · h:44 — Focus: borde #FFB606 · stroke 2 — Dropdown: mismo estilo + chevron
 */

interface FieldShellProps {
  id: string;
  label?: string;
  /** Label en peso regular (formulario de carga del panel admin, Figma pág. 7) */
  plainLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

const FieldShell: React.FC<FieldShellProps> = ({ id, label, plainLabel, className = '', children }) => (
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
  </div>
);

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  plainLabel?: boolean;
  wrapperClassName?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} className={wrapperClassName}>
      <input id={fieldId} className={`field-input ${className}`} {...props} />
    </FieldShell>
  );
};

export const PasswordField: React.FC<Omit<TextFieldProps, 'type'>> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} className={wrapperClassName}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className={`field-input pr-12 ${className}`}
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

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  plainLabel?: boolean;
  wrapperClassName?: string;
  placeholder?: string;
  options: readonly string[];
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  plainLabel,
  wrapperClassName,
  className = '',
  placeholder,
  options,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} plainLabel={plainLabel} className={wrapperClassName}>
      <div className="relative">
        <select
          id={fieldId}
          className={`field-input appearance-none pr-10 cursor-pointer ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="w-5 h-5 text-faud-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </FieldShell>
  );
};
