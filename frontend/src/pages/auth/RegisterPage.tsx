import React from 'react';
import { Link } from 'react-router-dom';
import { AuthSplitLayout } from '../../components/layout/AuthSplitLayout';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/FormField';
import { InfoDot } from '../../components/ui/Decorations';
import { useToast } from '../../context/ToastContext';
import { DEPARTAMENTOS_SAN_JUAN } from '../../mocks/figma-fixtures';

/** Crear cuenta (Figma págs. 6 y 16) — el alta se conecta con el backend en la Fase 1 */
export const RegisterPage: React.FC = () => {
  const { showToast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast({
      title: 'Registro disponible en la Fase 1',
      description: 'El formulario se conectará con POST /api/v1/auth/register.',
      variant: 'info',
    });
  };

  return (
    <AuthSplitLayout variant="register">
      <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-navy-mid leading-tight">
        Crear cuenta
      </h1>

      <form onSubmit={handleSubmit} className="mt-5 lg:mt-8 space-y-3 lg:space-y-4" noValidate>
        <TextField
          label="Nombre y apellido"
          name="nombre"
          autoComplete="name"
          placeholder="Juan Pérez"
          className="lg:h-12"
        />
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="juan@faud.unsj.edu.ar"
          className="lg:h-12"
        />
        <SelectField
          label="Departamento"
          name="departamento"
          placeholder="Seleccioná tu departamento"
          options={DEPARTAMENTOS_SAN_JUAN}
          defaultValue=""
          className="lg:h-12"
        />
        <TextField
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="lg:h-12"
        />

        <div className="!mt-5 lg:!mt-7 flex items-start gap-3 rounded-input border border-faud-amber/50 bg-faud-cream px-3 lg:px-4 py-3 lg:py-4 text-caption lg:text-[13px] leading-relaxed text-status-warning">
          <InfoDot tone="outline" className="hidden lg:inline-flex mt-0.5" />
          <p className="pl-6 lg:pl-0">
            <span className="lg:hidden">Validaremos tu cuenta.</span>
            <span className="hidden lg:inline">Validaremos tu cuenta según tu departamento.</span>
            <br />
            Te avisamos por correo cuando esté aprobada.
          </p>
        </div>

        <Button type="submit" size="lg" fullWidth className="!mt-5 lg:!mt-7 rounded-input text-[16px]">
          Crear cuenta
        </Button>
      </form>

      <p className="mt-5 lg:mt-6 text-center text-caption lg:text-body text-faud-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-bold text-faud-gold-dark hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </AuthSplitLayout>
  );
};
