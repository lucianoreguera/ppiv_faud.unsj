import React, { useId } from 'react';

/**
 * Marca de agua dinámica (Spec FE-04 · Figma pág. 14): mosaico diagonal con la leyenda del préstamo
 * tal como la devuelve el Backend ("Ana Pérez · Préstamo #0016"), superpuesto a la página renderizada.
 * No intercepta clics ni se puede seleccionar; el sello impreso en el canvas (pdf-engine) la respalda.
 */
export const DynamicWatermark: React.FC<{ text: string; scale?: number }> = ({ text, scale = 1 }) => {
  const patternId = `drm-watermark-${useId().replace(/:/g, '')}`;
  const fontSize = Math.max(12, Math.round(22 * scale));
  const tileWidth = Math.round(text.length * fontSize * 0.62 + fontSize * 4);
  const tileHeight = fontSize * 7;

  return (
    <div
      aria-hidden="true"
      data-testid="drm-watermark"
      data-watermark={text}
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={patternId}
            width={tileWidth}
            height={tileHeight}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-35)"
          >
            {/* Segunda fila desplazada media baldosa (se dibuja dos veces porque el patrón recorta cada baldosa) */}
            {[
              { x: 0, y: fontSize * 2 },
              { x: tileWidth / 2, y: fontSize * 5.5 },
              { x: -tileWidth / 2, y: fontSize * 5.5 },
            ].map(({ x, y }) => (
              <text
                key={`${x}-${y}`}
                x={x}
                y={y}
                fontFamily="Inter, Arial, sans-serif"
                fontSize={fontSize}
                fontWeight={700}
                fill="#E6A303"
                fillOpacity={0.28}
              >
                {text}
              </text>
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
};
