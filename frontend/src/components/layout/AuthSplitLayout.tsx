import React from 'react';
import { CornerAccents, GoldenRatioMotif } from '../ui/Decorations';
import { FaudLogo, UnsjLogo } from './Brand';

/**
 * Layout Login / Registro (Figma págs. 5, 6 y 16): panel de marca oscuro + formulario sobre crema.
 * - variant 'login':    logos institucionales, foto del edificio FAUD y líneas guía.
 * - variant 'register': panel sobrio con rectángulos áureos.
 */
export interface AuthSplitLayoutProps {
  variant: 'login' | 'register';
  children: React.ReactNode;
}

const BrandCopy: React.FC = () => (
  <div className="relative">
    <p className="text-[40px] font-bold leading-tight tracking-tight text-faud-amber">Repositorio FAUD</p>
    <p className="text-[15px] text-faud-amber mt-1">FAUD-UNSJ · Préstamo Digital Interdepartamental</p>
    <p className="mt-24 text-[26px] font-bold leading-[1.6] text-faud-text-cream">
      Conocimiento académico,
      <br />
      al alcance de toda
      <br />
      la provincia.
    </p>
  </div>
);

const DesktopBrandPanel: React.FC<{ variant: AuthSplitLayoutProps['variant'] }> = ({ variant }) => (
  <aside className="hidden lg:block relative w-[41.67%] shrink-0 min-h-screen bg-faud-dark overflow-hidden">
    <CornerAccents inset={40} size={20} />

    {variant === 'login' ? (
      <>
        {/* Logos UNSJ + FAUD */}
        <div className="absolute top-[34px] inset-x-0 flex items-center justify-center gap-24">
          <UnsjLogo className="w-16 h-16" />
          <FaudLogo className="h-16" />
        </div>

        {/* Líneas guía horizontales + vertical con nodos (blueprint) */}
        <span aria-hidden="true" className="absolute left-[100px] inset-y-0 w-px bg-faud-amber/[0.12]" />
        <span aria-hidden="true" className="absolute left-[60px] right-[60px] top-[118px] h-px bg-faud-amber/40" />
        <span aria-hidden="true" className="absolute left-[60px] right-[60px] bottom-[120px] h-px bg-faud-amber/40" />
        <span aria-hidden="true" className="absolute left-[96px] top-[114px] w-[9px] h-[9px] rounded-full border border-faud-amber bg-faud-dark" />
        <span aria-hidden="true" className="absolute left-[96px] bottom-[116px] w-[9px] h-[9px] rounded-full border border-faud-amber bg-faud-dark" />

        {/* Foto del edificio FAUD velada */}
        <div className="absolute left-[100px] right-[60px] top-[119px] bottom-[121px] overflow-hidden">
          <img
            src="/brand/faud-edificio.jpg"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-[72%_center] opacity-25 grayscale-[35%]"
            draggable={false}
          />
          <div className="absolute inset-0 bg-faud-dark/40" />
        </div>

        <div className="absolute left-[120px] right-[60px] top-[195px]">
          <BrandCopy />
          <GoldenRatioMotif className="mt-12 ml-7 w-[324px]" />
        </div>

        <p className="absolute bottom-[58px] inset-x-0 text-center text-body text-faud-muted">
          Desarrollado por : DHL Solutions
        </p>
      </>
    ) : (
      <>
        <span aria-hidden="true" className="absolute left-[60px] right-[60px] top-[156px] h-px bg-faud-amber/40" />
        <span aria-hidden="true" className="absolute left-[60px] right-[60px] bottom-[120px] h-px bg-faud-amber/40" />

        <div className="absolute left-[120px] right-[60px] top-[195px]">
          <BrandCopy />
          <GoldenRatioMotif className="mt-12 ml-7 w-[324px]" />
        </div>

        <p className="absolute bottom-[58px] left-[120px] text-body text-faud-muted">
          Facultad de Arquitectura, Urbanismo y Diseño · UNSJ
        </p>
      </>
    )}
  </aside>
);

const MobileBrandHeader: React.FC<{ variant: AuthSplitLayoutProps['variant'] }> = ({ variant }) => (
  <div
    className={`lg:hidden relative bg-faud-dark overflow-hidden px-5 ${
      variant === 'login' ? 'pt-10 pb-14' : 'pt-9 pb-12'
    }`}
  >
    {variant === 'login' && (
      <>
        <img
          src="/brand/faud-edificio.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-[72%_center] opacity-20"
          draggable={false}
        />
        <CornerAccents corners={['tl', 'tr']} inset={16} size={14} />
      </>
    )}
    <div className="relative">
      <p className="text-[24px] font-bold text-faud-amber leading-tight">Repositorio FAUD</p>
      <p className="text-[11px] text-faud-amber mt-0.5">FAUD-UNSJ · Préstamo Digital</p>
      {variant === 'login' && (
        <p className="mt-6 text-[20px] font-bold leading-snug text-faud-text-cream">
          Conocimiento académico,
          <br />
          al alcance de toda
          <br />
          la provincia.
        </p>
      )}
    </div>
  </div>
);

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({ variant, children }) => (
  <div className="min-h-screen flex flex-col lg:flex-row bg-faud-dark lg:bg-faud-cream">
    <DesktopBrandPanel variant={variant} />
    <MobileBrandHeader variant={variant} />

    <section className="relative flex-1 flex items-start lg:items-center justify-center bg-faud-cream -mt-6 lg:mt-0 rounded-t-[24px] lg:rounded-none overflow-hidden">
      {variant === 'login' && (
        // Diagonales de esquina a esquina detrás de la tarjeta (Figma pág. 5)
        <svg
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path d="M0 0L100 100M100 0L0 100" stroke="#C9BFAE" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
      )}

      <div className={`relative w-full ${variant === 'login' ? 'lg:w-[440px]' : 'lg:w-[480px]'} lg:my-10 bg-transparent lg:bg-white lg:rounded-[14px] lg:shadow-auth px-5 pt-7 pb-10 lg:px-12 lg:pt-14 lg:pb-14`}>
        <div className="hidden lg:block">
          <CornerAccents inset={20} size={20} />
        </div>
        {children}
      </div>
    </section>
  </div>
);
