import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * MailService abstraction. The dev implementation logs the message so the OTP
 * can be read from the API logs; a real SMTP/provider implementation can be
 * swapped in without touching the auth flow.
 */
export interface MailService {
  send(message: MailMessage): Promise<void>;
}

@Injectable()
export class ConsoleMailService implements MailService {
  constructor(private readonly logger: Logger) {}

  async send(message: MailMessage): Promise<void> {
    // NOTE: this intentionally logs the OTP body for local development only.
    this.logger.log(
      { to: message.to, subject: message.subject, body: message.text, mailer: 'console' },
      'Outgoing email (dev mailer)',
    );
  }
}

export const MAIL_SERVICE = 'MAIL_SERVICE';
