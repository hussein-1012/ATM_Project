import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { Resend } from 'resend';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * MailService abstraction.
 * - ConsoleMailService logs the email (dev mailer).
 * - ResendMailService sends emails using Resend.
 */
export interface MailService {
  send(message: MailMessage): Promise<void>;
}

@Injectable()
export class ConsoleMailService implements MailService {
  constructor(private readonly logger: Logger) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      { to: message.to, subject: message.subject, body: message.text, mailer: 'console' },
      'Outgoing email (dev mailer)',
    );
  }
}

@Injectable()
export class ResendMailService implements MailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {
    const apiKey = this.config.get<string>('resend.apiKey') ?? '';
    this.resend = new Resend(apiKey);
    this.from =
      this.config.get<string>('resend.from') || 'Aqrab Makina Leek <onboarding@resend.dev>';
  }

  async send(message: MailMessage): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (error) {
        this.logger.error({ error, to: message.to }, 'Failed to send email via Resend');
        throw new Error(`Resend error: ${error.message}`);
      }

      this.logger.log({ to: message.to, subject: message.subject }, 'Email sent via Resend');
    } catch (err: any) {
      this.logger.error({ err, to: message.to }, 'Error sending email via Resend');
      throw err;
    }
  }
}

export const MAIL_SERVICE = 'MAIL_SERVICE';
