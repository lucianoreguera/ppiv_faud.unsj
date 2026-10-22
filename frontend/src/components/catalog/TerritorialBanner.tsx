import React from 'react';
import { MapPinned } from 'lucide-react';
import type { TerritorialMetricsResponseDto } from '../../types/openapi.types';

export const formatCount = (value: number) => value.toLocaleString('es-AR');

/**
 * Alcance Territorial Interdepartamental (Spec FE-02) — GET /api/v1/departamentos/metricas
 * Destaca los documentos catalogados y la presencia en Capital + 18 departamentos de San Juan.
 */
export const TerritorialBanner: React.FC<{ metrics: TerritorialMetricsResponseDto; className?: string }> = ({
  metrics,
  className = '',
}) => {
  const departamentosConObras = metrics.departamentos.filter((d) => d.totalDocumentos > 0).length;
  const interior = Math.max(metrics.totalDepartamentos - 1, 0);

  const stats = [
    { value: metrics.totalDocumentosCatalogados, label: 'Documentos catalogados', highlight: true },
    { value: metrics.totalDepartamentos, label: 'Departamentos conectados', highlight: false },
    { value: departamentosConObras, label: 'Departamentos con obras', highlight: true },
    { value: metrics.usuariosDepartamentosAlejados, label: 'Usuarios fuera de Capital', highlight: false },
  ];

  return (
    <section
      aria-label="Alcance territorial interdepartamental"
      className={`relative overflow-hidden rounded-card bg-faud-dark text-white px-4 py-4 lg:px-7 lg:py-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-10 ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-faud-amber" />
      <div className="flex items-start gap-3 lg:max-w-[340px]">
        <MapPinned className="w-6 h-6 text-faud-amber shrink-0 mt-0.5" strokeWidth={1.75} />
        <div>
          <p className="text-overline uppercase text-faud-amber">Alcance territorial</p>
          <p className="mt-1 text-caption lg:text-body text-faud-text-cream">
            Capital + {interior} departamentos de San Juan acceden al repositorio de la FAUD-UNSJ.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:flex gap-x-4 gap-y-3 lg:gap-0 lg:ml-auto">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`flex flex-col lg:px-6 ${index > 0 ? 'lg:border-l lg:border-faud-amber/30' : ''}`}>
            <dt className="order-2 text-[11px] lg:text-caption text-faud-text-cream/80">{stat.label}</dt>
            <dd className={`text-[20px] lg:text-[26px] font-bold leading-tight ${stat.highlight ? 'text-faud-amber' : 'text-white'}`}>
              {formatCount(stat.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
