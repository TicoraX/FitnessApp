import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * Envío de mail, con dos implementaciones detrás de un método.
 *
 * En desarrollo el driver de consola imprime el link y no hay nada que
 * configurar: se copia del log y se sigue trabajando. En producción sale por
 * Resend. Cambiar a SES o a SMTP es una clase nueva, no tocar el servicio.
 */
export interface Mensaje {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class Mailer {
  private readonly logger = new Logger('mail');
  private readonly driver = process.env.MAIL_DRIVER ?? 'console';

  async send(m: Mensaje): Promise<void> {
    if (this.driver !== 'resend') {
      // El destinatario no se loguea: es PII y esto puede terminar en un
      // agregador de logs. El cuerpo lleva el link, que es lo que hace falta.
      this.logger.log(`[${this.driver}] ${m.subject}\n${m.text}`);
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'FitTrack <no-reply@fittrack.app>',
        to: [m.to],
        subject: m.subject,
        text: m.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Sin el cuerpo del error no hay forma de saber si es la key, el dominio
      // sin verificar o el destinatario. El mail en sí no se loguea.
      const detalle = await res.text().catch(() => '');
      throw new Error(`Resend respondió ${res.status}: ${detalle.slice(0, 200)}`);
    }
  }
}

@Global()
@Module({ providers: [Mailer], exports: [Mailer] })
export class MailModule {}
