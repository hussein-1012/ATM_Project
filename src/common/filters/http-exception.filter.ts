import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/** Map well-known HTTP statuses to stable machine-readable codes. */
function defaultCodeFor(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

/**
 * Global exception filter. Every error response is `{ statusCode, code, message }`.
 * Unexpected (non-HTTP) errors are logged with the request id and masked.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
        code = defaultCodeFor(status);
      } else if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        message = typeof body.message === 'string' ? body.message : exception.message;
        code = typeof body.code === 'string' ? body.code : defaultCodeFor(status);
        // Validation errors: keep the first field error readable, expose code VALIDATION_ERROR
        if (status === HttpStatus.BAD_REQUEST && Array.isArray(body.message)) {
          message = (body.message as string[]).join('; ');
          code = 'VALIDATION_ERROR';
        }
      }
    } else {
      this.logger.error(
        { err: exception, reqId: req.id },
        'Unhandled exception',
      );
    }

    const body: ErrorBody = { statusCode: status, code, message };
    res.status(status).json(body);
  }
}
