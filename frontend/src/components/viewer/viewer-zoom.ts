/**
 * Zoom del Visor Protegido (Figma pág. 14): pasos fijos, "100%" y "Ajustar ancho".
 * - `auto` (por defecto): tamaño real, salvo que la página no entre en el ancho disponible (mobile).
 * - `fit-width`: la página ocupa todo el ancho del área de lectura.
 */
export const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300] as const;

export type ZoomMode = { kind: 'auto' } | { kind: 'fit-width' } | { kind: 'percent'; value: number };

/** Margen horizontal del área de lectura alrededor de la página */
export const PAGE_GUTTER_PX = 32;

export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Escala efectiva (1 = 100%) para una página de `pageWidth` px CSS en un área de `containerWidth` px */
export function resolveZoomScale(zoom: ZoomMode, pageWidth: number, containerWidth: number): number {
  if (zoom.kind === 'percent') return zoom.value / 100;
  if (!(pageWidth > 0) || !(containerWidth > 0)) return 1;
  // Sin mínimo: en un celular la página tiene que entrar completa aunque quede por debajo del 50%
  const fit = Math.max(0.1, (containerWidth - PAGE_GUTTER_PX) / pageWidth);
  return zoom.kind === 'fit-width' ? Math.min(fit, MAX_ZOOM / 100) : Math.min(1, fit);
}

/** Paso siguiente (+) o anterior (−) a partir del zoom efectivo actual */
export function stepZoom(currentPercent: number, direction: 1 | -1): number {
  const current = Math.round(currentPercent);
  if (direction > 0) return ZOOM_STEPS.find((step) => step > current) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < current) ?? MIN_ZOOM;
}
