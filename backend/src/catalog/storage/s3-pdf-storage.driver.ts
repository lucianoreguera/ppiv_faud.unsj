import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import * as path from 'path';
import { Readable } from 'stream';
import {
  PdfReadStream,
  PdfStorageDriver,
} from './pdf-storage-driver.interface';

export interface S3PdfStorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const KEY_PREFIX = 'pdfs/';

/**
 * Almacenamiento privado en un bucket compatible con S3 (Backblaze B2, Cloudflare R2, MinIO, AWS S3).
 * El bucket debe ser privado: el Backend sigue siendo el único que entrega el PDF, siempre detrás de la
 * validación DRM, por lo que no se generan URLs firmadas ni públicas.
 */
export class S3PdfStorageDriver implements PdfStorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3PdfStorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // Los checksums CRC32 por defecto del SDK no son aceptados por todos los proveedores compatibles
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async save(fileName: string, buffer: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(fileName),
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );
  }

  async exists(fileName: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(fileName),
        }),
      );
      return true;
    } catch (error) {
      if (S3PdfStorageDriver.isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async delete(fileName: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(fileName),
      }),
    );
  }

  async open(fileName: string): Promise<PdfReadStream | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(fileName),
        }),
      );
      return {
        stream: object.Body as Readable,
        sizeBytes: object.ContentLength ?? 0,
      };
    } catch (error) {
      if (S3PdfStorageDriver.isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  private toKey(fileName: string): string {
    return `${KEY_PREFIX}${path.basename(fileName)}`;
  }

  private static isNotFound(error: unknown): boolean {
    const err = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    return (
      err?.name === 'NotFound' ||
      err?.name === 'NoSuchKey' ||
      err?.$metadata?.httpStatusCode === 404
    );
  }
}
