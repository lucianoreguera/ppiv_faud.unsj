import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { LocalPdfStorageDriver } from './local-pdf-storage.driver';
import { S3PdfStorageDriver } from './s3-pdf-storage.driver';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

describe('Drivers de almacenamiento privado de PDFs (RF01 / RNF02)', () => {
  const pdfBuffer = Buffer.from('%PDF-1.4 contenido de prueba');

  describe('LocalPdfStorageDriver', () => {
    let tempDir: string;
    let driver: LocalPdfStorageDriver;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'faud-pdfs-'));
      driver = new LocalPdfStorageDriver(tempDir);
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('debe guardar, abrir como stream y eliminar un PDF', async () => {
      await driver.save('tesis.pdf', pdfBuffer);
      expect(await driver.exists('tesis.pdf')).toBe(true);

      const opened = await driver.open('tesis.pdf');
      expect(opened?.sizeBytes).toBe(pdfBuffer.length);
      expect(await readAll(opened!.stream)).toEqual(pdfBuffer);

      await driver.delete('tesis.pdf');
      expect(await driver.exists('tesis.pdf')).toBe(false);
      expect(await driver.open('tesis.pdf')).toBeNull();
    });

    it('debe confinar las rutas al directorio privado (Path Traversal)', () => {
      expect(driver.resolveSafePath('../../etc/passwd')).toBe(
        path.join(tempDir, 'passwd'),
      );
    });
  });

  describe('S3PdfStorageDriver (Backblaze B2 / S3 compatible)', () => {
    let sendSpy: jest.SpyInstance;
    let driver: S3PdfStorageDriver;

    beforeEach(() => {
      sendSpy = jest.spyOn(S3Client.prototype, 'send');
      driver = new S3PdfStorageDriver({
        endpoint: 'https://s3.us-east-005.backblazeb2.com',
        region: 'us-east-005',
        bucket: 'faud-unsj-pdfs',
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret',
      });
    });

    afterEach(() => {
      sendSpy.mockRestore();
    });

    it('save() debe subir el PDF al bucket privado bajo el prefijo pdfs/ con Content-Type application/pdf', async () => {
      sendSpy.mockResolvedValue({});

      await driver.save('storage/pdfs/tesis.pdf', pdfBuffer);

      const command = sendSpy.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual(
        expect.objectContaining({
          Bucket: 'faud-unsj-pdfs',
          Key: 'pdfs/tesis.pdf',
          ContentType: 'application/pdf',
        }),
      );
    });

    it('exists() debe retornar false ante un 404 y propagar cualquier otro error', async () => {
      sendSpy.mockRejectedValueOnce({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });
      expect(await driver.exists('inexistente.pdf')).toBe(false);
      expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);

      sendSpy.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      await expect(driver.exists('tesis.pdf')).rejects.toEqual(
        expect.objectContaining({ name: 'AccessDenied' }),
      );
    });

    it('open() debe devolver el stream y el tamaño del objeto, o null si no existe', async () => {
      sendSpy.mockResolvedValueOnce({
        Body: Readable.from(pdfBuffer),
        ContentLength: pdfBuffer.length,
      });

      const opened = await driver.open('tesis.pdf');
      expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
      expect(opened?.sizeBytes).toBe(pdfBuffer.length);
      expect(await readAll(opened!.stream)).toEqual(pdfBuffer);

      sendSpy.mockRejectedValueOnce({ name: 'NoSuchKey' });
      expect(await driver.open('inexistente.pdf')).toBeNull();
    });
  });
});
