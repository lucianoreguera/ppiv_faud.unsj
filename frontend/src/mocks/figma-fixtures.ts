/**
 * Datos de ejemplo tomados literalmente de los prototipos Figma
 * (documentación/Presentacion_Prototipos_Figma_Segunda_Etapa_DHL_Solutions.pdf).
 *
 * Alimentan las vistas en la Fase 0 para validar el diseño. Cada fase posterior
 * reemplaza su porción por la respuesta real del Backend (docs/specs/openapi.json).
 */
export const DEPARTAMENTOS_SAN_JUAN = [
  'Albardón',
  'Angaco',
  'Calingasta',
  'Capital',
  'Caucete',
  'Chimbas',
  'Iglesia',
  'Jáchal',
  '9 de Julio',
  'Pocito',
  'Rawson',
  'Rivadavia',
  'San Martín',
  'Santa Lucía',
  'Sarmiento',
  'Ullum',
  'Valle Fértil',
  '25 de Mayo',
  'Zonda',
] as const;

/** Figma pág. 14 */
export const VIEWER_FIXTURE = {
  prestamoId: '1024',
  titulo: 'Accesibilidad urbana en San Juan',
  tituloPagina: 'Accesibilidad Urbana y Diseño Universal',
  subtituloPagina: 'Capítulo 1: Fundamentos en San Juan',
  totalPaginas: 84,
  diasRestantes: 5,
  marcaAgua: 'Ana Pérez · Préstamo #1024',
};
