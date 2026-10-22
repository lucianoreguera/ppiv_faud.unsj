import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoValidacionUsuario, TipoNotificacion } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailDispatchResult {
  sent: boolean;
  to: string;
  subject: string;
  tipo: TipoNotificacion | 'VALIDACION_CUENTA';
  messageId?: string;
  timestamp: Date;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly sentHistory: EmailDispatchResult[] = [];

  constructor(private readonly configService: ConfigService) {
    this.smtpHost = this.configService.get<string>('smtp.host', 'localhost');
    this.smtpPort = this.configService.get<number>('smtp.port', 1025);
    this.fromAddress = this.configService.get<string>(
      'smtp.from',
      'Biblioteca FAUD-UNSJ <biblioteca@faud.unsj.edu.ar>',
    );

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: false,
      ignoreTLS: true,
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 5000,
    });
  }

  /**
   * Envía el recordatorio automático 24 horas antes del vencimiento del préstamo (RF06 — Figura 2 y Figura 4).
   */
  async sendExpirationReminder24hEmail(params: {
    to: string;
    usuarioNombre: string;
    departamentoNombre: string;
    codigoFormateado: string;
    documentoTitulo: string;
    documentoAutor: string;
    fechaVencimiento: Date;
    horasRestantes: number;
  }): Promise<EmailDispatchResult> {
    const subject = `[FAUD-UNSJ] Recordatorio: Su préstamo ${params.codigoFormateado} vence en menos de 24 horas`;
    const fechaFormateada = this.formatDateAR(params.fechaVencimiento);

    const text = [
      `Hola ${params.usuarioNombre} (${params.departamentoNombre}),`,
      '',
      `Le recordamos desde la Biblioteca de la Facultad de Arquitectura, Urbanismo y Diseño (FAUD-UNSJ) que su préstamo digital temporal está próximo a vencer.`,
      '',
      `- Código de préstamo: ${params.codigoFormateado}`,
      `- Documento académico: "${params.documentoTitulo}" (${params.documentoAutor})`,
      `- Fecha y hora de vencimiento: ${fechaFormateada}`,
      `- Tiempo restante estimado: ${params.horasRestantes} hora(s)`,
      '',
      `Recuerde que una vez cumplido el plazo de 7 días corridos, el acceso de visualización protegida se cerrará automáticamente (RF04 / RF06).`,
      '',
      `Atentamente,`,
      `Biblioteca FAUD-UNSJ · Sistema de Préstamo Digital Interdepartamental`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e3a8a; color: #ffffff; padding: 16px 24px;">
          <h2 style="margin: 0; font-size: 18px;">Biblioteca FAUD-UNSJ · Aviso de Vencimiento (24h)</h2>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
          <p>Hola <strong>${params.usuarioNombre}</strong> (Departamento: <strong>${params.departamentoNombre}</strong>),</p>
          <p>Le informamos que su préstamo digital temporal se encuentra dentro de las últimas <strong>24 horas de vigencia</strong>:</p>
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Préstamo:</strong> ${params.codigoFormateado}</p>
            <p style="margin: 4px 0;"><strong>Documento:</strong> ${params.documentoTitulo}</p>
            <p style="margin: 4px 0;"><strong>Autor:</strong> ${params.documentoAutor}</p>
            <p style="margin: 4px 0;"><strong>Vencimiento:</strong> ${fechaFormateada} (${params.horasRestantes} h restantes)</p>
          </div>
          <p style="font-size: 13px; color: #475569;">Al cumplirse los 7 días corridos desde su otorgamiento, el token de acceso temporal expirará y el visor protegido bloqueará automáticamente la lectura.</p>
        </div>
      </div>
    `;

    return this.dispatchMail({
      to: params.to,
      subject,
      text,
      html,
      tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
    });
  }

  /**
   * Envía la notificación de vencimiento y cierre automático del préstamo al cumplirse los 7 días (Figura 4).
   */
  async sendLoanExpiredEmail(params: {
    to: string;
    usuarioNombre: string;
    departamentoNombre: string;
    codigoFormateado: string;
    documentoTitulo: string;
    documentoAutor: string;
    fechaVencimiento: Date;
  }): Promise<EmailDispatchResult> {
    const subject = `[FAUD-UNSJ] Préstamo ${params.codigoFormateado} finalizado por vencimiento de plazo (7 días)`;
    const fechaFormateada = this.formatDateAR(params.fechaVencimiento);

    const text = [
      `Hola ${params.usuarioNombre} (${params.departamentoNombre}),`,
      '',
      `Le informamos que el plazo reglamentario de 7 días corridos para el préstamo digital ${params.codigoFormateado} sobre el documento "${params.documentoTitulo}" (${params.documentoAutor}) ha expirado el ${fechaFormateada}.`,
      '',
      `El estado del préstamo ha pasado automáticamente a VENCIDO y el acceso al visor protegido ha finalizado. Si necesita consultar nuevamente la obra, puede gestionar una nueva solicitud desde el catálogo en línea.`,
      '',
      `Atentamente,`,
      `Biblioteca FAUD-UNSJ · Sistema de Préstamo Digital Interdepartamental`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #334155; color: #ffffff; padding: 16px 24px;">
          <h2 style="margin: 0; font-size: 18px;">Biblioteca FAUD-UNSJ · Préstamo Vencido</h2>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
          <p>Hola <strong>${params.usuarioNombre}</strong> (${params.departamentoNombre}),</p>
          <p>El plazo de 7 días corridos de su préstamo digital ha finalizado:</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Préstamo:</strong> ${params.codigoFormateado}</p>
            <p style="margin: 4px 0;"><strong>Documento:</strong> ${params.documentoTitulo} (${params.documentoAutor})</p>
            <p style="margin: 4px 0;"><strong>Estado actual:</strong> VENCIDO (${fechaFormateada})</p>
          </div>
          <p style="font-size: 13px; color: #475569;">El acceso al visor PDF ha quedado deshabilitado. Puede solicitar un nuevo préstamo desde el catálogo cuando lo requiera.</p>
        </div>
      </div>
    `;

    return this.dispatchMail({
      to: params.to,
      subject,
      text,
      html,
      tipo: TipoNotificacion.PRESTAMO_VENCIDO,
    });
  }

  /**
   * Envía la confirmación de otorgamiento de un préstamo digital por 7 días corridos (RF03 / RF06).
   */
  async sendLoanGrantedEmail(params: {
    to: string;
    usuarioNombre: string;
    departamentoNombre: string;
    codigoFormateado: string;
    documentoTitulo: string;
    documentoAutor: string;
    fechaInicio: Date;
    fechaVencimiento: Date;
  }): Promise<EmailDispatchResult> {
    const subject = `[FAUD-UNSJ] Préstamo digital ${params.codigoFormateado} otorgado por 7 días`;
    const vencimientoStr = this.formatDateAR(params.fechaVencimiento);

    const text = [
      `Hola ${params.usuarioNombre} (${params.departamentoNombre}),`,
      '',
      `Su solicitud de préstamo digital ha sido aprobada y activada:`,
      `- Código de préstamo: ${params.codigoFormateado}`,
      `- Documento: "${params.documentoTitulo}" (${params.documentoAutor})`,
      `- Vigencia hasta: ${vencimientoStr} (7 días corridos)`,
      '',
      `Ya puede acceder a la lectura en línea desde la sección "Mis Préstamos".`,
      '',
      `Atentamente,`,
      `Biblioteca FAUD-UNSJ`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #166534; color: #ffffff; padding: 16px 24px;">
          <h2 style="margin: 0; font-size: 18px;">Biblioteca FAUD-UNSJ · Préstamo Digital Activo</h2>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
          <p>Hola <strong>${params.usuarioNombre}</strong> (${params.departamentoNombre}),</p>
          <p>Su préstamo digital temporal por <strong>7 días corridos</strong> se encuentra activo:</p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Préstamo:</strong> ${params.codigoFormateado}</p>
            <p style="margin: 4px 0;"><strong>Documento:</strong> ${params.documentoTitulo} (${params.documentoAutor})</p>
            <p style="margin: 4px 0;"><strong>Vencimiento:</strong> ${vencimientoStr}</p>
          </div>
        </div>
      </div>
    `;

    return this.dispatchMail({
      to: params.to,
      subject,
      text,
      html,
      tipo: TipoNotificacion.PRESTAMO_OTORGADO,
    });
  }

  /**
   * Envía aviso de revocación manual de préstamo por parte de Biblioteca (RF04).
   */
  async sendLoanRevokedEmail(params: {
    to: string;
    usuarioNombre: string;
    departamentoNombre: string;
    codigoFormateado: string;
    documentoTitulo: string;
    motivo: string;
  }): Promise<EmailDispatchResult> {
    const subject = `[FAUD-UNSJ] Préstamo ${params.codigoFormateado} revocado por Biblioteca`;

    const text = [
      `Hola ${params.usuarioNombre} (${params.departamentoNombre}),`,
      '',
      `Le informamos que el préstamo digital ${params.codigoFormateado} sobre "${params.documentoTitulo}" fue revocado por la administración de Biblioteca FAUD-UNSJ.`,
      `Motivo: ${params.motivo}`,
      '',
      `El acceso de visualización al documento ha sido deshabilitado de forma inmediata.`,
      '',
      `Atentamente,`,
      `Biblioteca FAUD-UNSJ`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #991b1b; color: #ffffff; padding: 16px 24px;">
          <h2 style="margin: 0; font-size: 18px;">Biblioteca FAUD-UNSJ · Préstamo Revocado</h2>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
          <p>Hola <strong>${params.usuarioNombre}</strong> (${params.departamentoNombre}),</p>
          <p>El préstamo <strong>${params.codigoFormateado}</strong> sobre <em>"${params.documentoTitulo}"</em> ha sido revocado manualmente por Biblioteca.</p>
          <p><strong>Motivo informado:</strong> ${params.motivo}</p>
        </div>
      </div>
    `;

    return this.dispatchMail({
      to: params.to,
      subject,
      text,
      html,
      tipo: TipoNotificacion.PRESTAMO_REVOCADO,
    });
  }

  /**
   * Envía aviso de validación de cuenta de usuario departamental (RF05).
   */
  async sendAccountValidationEmail(params: {
    to: string;
    usuarioNombre: string;
    departamentoNombre: string;
    estado: EstadoValidacionUsuario;
    motivo?: string;
  }): Promise<EmailDispatchResult> {
    const aprobado = params.estado === EstadoValidacionUsuario.APROBADO;
    const subject = aprobado
      ? `[FAUD-UNSJ] Su cuenta ha sido APROBADA por Biblioteca`
      : `[FAUD-UNSJ] Actualización de estado de su cuenta (${params.estado})`;

    const text = [
      `Hola ${params.usuarioNombre} (Departamento: ${params.departamentoNombre}),`,
      '',
      aprobado
        ? `Su cuenta en el Sistema de Préstamo Digital Interdepartamental de la FAUD-UNSJ ha sido validada y APROBADA por Biblioteca. Ya puede iniciar sesión y solicitar préstamos digitales.`
        : `El estado de validación de su cuenta ha sido actualizado a: ${params.estado}.`,
      params.motivo ? `Observaciones: ${params.motivo}` : '',
      '',
      `Atentamente,`,
      `Biblioteca FAUD-UNSJ`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${aprobado ? '#1e3a8a' : '#475569'}; color: #ffffff; padding: 16px 24px;">
          <h2 style="margin: 0; font-size: 18px;">Biblioteca FAUD-UNSJ · Validación de Usuario</h2>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
          <p>Hola <strong>${params.usuarioNombre}</strong> (${params.departamentoNombre}),</p>
          <p>El estado de validación de su cuenta es: <strong>${params.estado}</strong>.</p>
          ${params.motivo ? `<p><strong>Observaciones:</strong> ${params.motivo}</p>` : ''}
        </div>
      </div>
    `;

    return this.dispatchMail({
      to: params.to,
      subject,
      text,
      html,
      tipo: aprobado ? TipoNotificacion.CUENTA_APROBADA : 'VALIDACION_CUENTA',
    });
  }

  /**
   * Devuelve el historial en memoria de correos despachados durante la ejecución actual.
   */
  getSentHistory(): EmailDispatchResult[] {
    return [...this.sentHistory];
  }

  private async dispatchMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    tipo: TipoNotificacion | 'VALIDACION_CUENTA';
  }): Promise<EmailDispatchResult> {
    const timestamp = new Date();
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      const result: EmailDispatchResult = {
        sent: true,
        to: options.to,
        subject: options.subject,
        tipo: options.tipo,
        messageId: info.messageId,
        timestamp,
      };
      this.sentHistory.unshift(result);
      if (this.sentHistory.length > 200) {
        this.sentHistory.pop();
      }

      this.logger.log(
        `Correo [${options.tipo}] enviado a ${options.to} via SMTP (${this.smtpHost}:${this.smtpPort}) - MessageID: ${info.messageId}`,
      );
      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Error SMTP desconocido';
      const result: EmailDispatchResult = {
        sent: false,
        to: options.to,
        subject: options.subject,
        tipo: options.tipo,
        timestamp,
        error: errorMsg,
      };
      this.sentHistory.unshift(result);
      if (this.sentHistory.length > 200) {
        this.sentHistory.pop();
      }

      this.logger.warn(
        `No se pudo despachar correo SMTP a ${options.to} (${this.smtpHost}:${this.smtpPort}): ${errorMsg}. La notificación quedó registrada en base de datos.`,
      );
      return result;
    }
  }

  private formatDateAR(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}
