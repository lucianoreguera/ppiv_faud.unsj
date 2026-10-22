import React from 'react';

/**
 * Botones del Design System (Figma pág. 23)
 * - primary:   Ámbar #FFB606 · hover #FFCA28 · texto #1A1A2E
 * - secondary: Outlined · borde #FFB606 · texto #E6A303
 * - danger:    Danger outlined · borde #B3261E · texto #B3261E
 * - neutral:   Blanco · borde #E8DCC8 (Cancelar, Rechazar)
 * - disabled:  #F3F4F6 · texto #9CA3AF
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'neutral' | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-faud-amber text-faud-ink hover:bg-faud-gold-hover font-bold',
  secondary:
    'bg-white text-faud-gold-dark border border-faud-amber hover:bg-faud-amber-light font-bold',
  danger: 'bg-white text-status-danger border border-status-danger hover:bg-status-danger-bg font-bold',
  neutral:
    'bg-white text-faud-text border border-faud-border-warm hover:border-faud-amber font-bold',
  ghost: 'bg-transparent text-faud-text hover:bg-faud-amber-light font-medium',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-caption rounded-[6px] gap-1.5',
  md: 'h-11 px-5 text-body rounded-input gap-2',
  lg: 'h-12 px-6 text-body rounded-btn gap-2',
};

export const buttonClasses = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string =>
  `inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faud-amber focus-visible:ring-offset-2 disabled:bg-status-inactive-bg disabled:text-status-disabled disabled:border-transparent disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${extra}`;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={buttonClasses(variant, size, `${fullWidth ? 'w-full' : ''} ${className}`)}
      {...props}
    >
      {isLoading ? (
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
