import { ConsoleMailService, ResendMailService } from './mail.service';
import type { ConfigService } from '@nestjs/config';
import type { Logger } from 'nestjs-pino';

describe('MailService', () => {
  let logger: jest.Mocked<Partial<Logger>>;
  let config: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    logger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'resend.apiKey') return 're_test_123';
        if (key === 'resend.from') return 'Test <test@example.com>';
        return undefined;
      }),
    };
  });

  describe('ConsoleMailService', () => {
    it('logs outgoing emails in dev', async () => {
      const consoleService = new ConsoleMailService(logger as unknown as Logger);
      await consoleService.send({
        to: 'user@example.com',
        subject: 'Reset Code',
        text: 'Your code is 123456',
      });

      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com', subject: 'Reset Code' }),
        'Outgoing email (dev mailer)',
      );
    });
  });

  describe('ResendMailService', () => {
    it('initializes and attempts to send email via Resend SDK', async () => {
      const resendService = new ResendMailService(
        config as unknown as ConfigService,
        logger as unknown as Logger,
      );

      // Mock the inner resend client
      const sendMock = jest.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null });
      (resendService as any).resend = { emails: { send: sendMock } };

      await resendService.send({
        to: 'user@example.com',
        subject: 'Reset Code',
        text: 'Your code is 123456',
        html: '<p>Your code is 123456</p>',
      });

      expect(sendMock).toHaveBeenCalledWith({
        from: 'Test <test@example.com>',
        to: 'user@example.com',
        subject: 'Reset Code',
        text: 'Your code is 123456',
        html: '<p>Your code is 123456</p>',
      });
      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' }),
        'Email sent via Resend',
      );
    });

    it('throws when resend returns an error', async () => {
      const resendService = new ResendMailService(
        config as unknown as ConfigService,
        logger as unknown as Logger,
      );

      const sendMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Domain not verified', name: 'validation_error' },
      });
      (resendService as any).resend = { emails: { send: sendMock } };

      await expect(
        resendService.send({
          to: 'user@example.com',
          subject: 'Reset Code',
          text: 'Your code is 123456',
        }),
      ).rejects.toThrow('Resend error: Domain not verified');

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
