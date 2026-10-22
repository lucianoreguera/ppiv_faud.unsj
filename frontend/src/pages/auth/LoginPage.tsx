import React from 'react';
import { Link } from 'react-router-dom';
import { AuthSplitLayout } from '../../components/layout/AuthSplitLayout';
import { Button } from '../../components/ui/Button';
import { PasswordField, TextField } from '../../components/ui/FormField';
import { useToast } from '../../context/ToastContext';

/** Iniciar sesión (Figma págs. 5 y 16) — la autenticación JWT se conecta en la Fase 1 */
export const LoginPage: React.FC = () => {
  const { showToast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast({
      title: 'Inicio de sesión disponible en la Fase 1',
      description: 'El formulario se conectará con POST /api/v1/auth/login.',
      variant: 'info',
    });
  };

  return (
    <AuthSplitLayout variant="login">
      <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-navy-mid leading-tight">
        Iniciar sesión
      </h1>
      <p className="text-caption lg:text-[15px] text-faud-muted mt-1 lg:mt-2">
        <span className="lg:hidden">Accedé para solicitar préstamos.</span>
        <span className="hidden lg:inline">Accedé para solicitar y leer préstamos digitales.</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-7 lg:mt-8" noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="ejemplo@faud.unsj.edu.ar"
          className="lg:h-12"
        />
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          placeholder="••••••"
          wrapperClassName="mt-5"
          className="lg:h-12"
        />
        <div className="mt-3 text-center">
          <Link to="/login" className="text-caption lg:text-body font-bold text-faud-gold-dark hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth className="mt-7 lg:mt-8 rounded-input text-[16px]">
          Ingresar
        </Button>
      </form>

      <p className="mt-6 lg:mt-9 text-center text-caption lg:text-body text-faud-muted">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-bold text-faud-gold-dark hover:underline">
          Registrate
        </Link>
      </p>
    </AuthSplitLayout>
  );
};
