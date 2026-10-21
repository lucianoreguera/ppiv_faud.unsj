import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, promises as fs } from 'fs';
import { ValidatedDrmAccess } from './interfaces/loan-drm-payload.interface';

/**
 * Sanitiza un texto para que sea 100% seguro en encabezados HTTP (ISO-8859-1 / Latin-1 <= 0xFF).
 */
function toSafeHeaderValue(input: string): string {
  return Array.from(input)
    .map((ch) => (ch.charCodeAt(0) <= 0xff ? ch : '?'))
    .join('')
    .replace(/[\r\n]+/g, ' ');
}

/**
 * Extrae el token DRM o de sesión desde:
 * 1. Encabezado `Authorization: Bearer <token>`
 * 2. Encabezado `x-drm-token: <token>`
 * 3. Query param `?token=<token>`
 */
export function extractDrmTokenFromRequest(
  authorizationHeader?: string,
  drmHeader?: string,
  queryToken?: string,
): string | undefined {
  if (drmHeader && drmHeader.trim().length > 0) {
    return drmHeader.trim();
  }
  if (queryToken && queryToken.trim().length > 0) {
    return queryToken.trim();
  }
  if (authorizationHeader && authorizationHeader.trim().length > 0) {
    return authorizationHeader.trim();
  }
  return undefined;
}

/**
 * Configura los encabezados de seguridad DRM Temporal (RF04 / RNF02 / Figma pág. 14)
 * y retorna el `StreamableFile` del PDF almacenado en forma privada.
 */
export async function buildProtectedPdfStream(
  res: Response,
  access: ValidatedDrmAccess,
): Promise<StreamableFile> {
  const stats = await fs.stat(access.absolutePdfPath);
  const inlineFileName = `faud-unsj-prestamo-${access.codigoReferencia}.pdf`;
  const safeWatermark = toSafeHeaderValue(access.marcaAgua);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(stats.size),
    'Content-Disposition': `inline; filename="${inlineFileName}"`,
    'Cache-Control':
      'no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-DRM-Loan-Id': access.prestamoId,
    'X-DRM-Loan-Code': access.codigoFormateado,
    'X-DRM-Document-Id': access.documentoId,
    'X-DRM-Watermark': safeWatermark,
    'X-DRM-Watermark-URI': encodeURIComponent(access.marcaAgua),
    'X-DRM-Expires-At': access.fechaVencimiento.toISOString(),
    'X-DRM-Remaining-Days': String(access.diasRestantes),
    'X-DRM-Remaining-Hours': String(access.horasRestantes),
    'X-DRM-Por-Vencer-24h': String(access.porVencer24h),
    'X-DRM-Allow-Download': 'false',
    'X-DRM-Allow-Print': 'false',
    'X-DRM-Allow-Copy': 'false',
    'Access-Control-Expose-Headers': [
      'Content-Disposition',
      'X-DRM-Loan-Id',
      'X-DRM-Loan-Code',
      'X-DRM-Document-Id',
      'X-DRM-Watermark',
      'X-DRM-Watermark-URI',
      'X-DRM-Expires-At',
      'X-DRM-Remaining-Days',
      'X-DRM-Remaining-Hours',
      'X-DRM-Por-Vencer-24h',
      'X-DRM-Allow-Download',
      'X-DRM-Allow-Print',
      'X-DRM-Allow-Copy',
    ].join(', '),
  });

  const fileStream = createReadStream(access.absolutePdfPath);
  return new StreamableFile(fileStream);
}
