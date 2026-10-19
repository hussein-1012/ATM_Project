import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Per-handler completion log at debug level (pino-http already logs the
 * finished request at info). Carries the request id from the middleware.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<{
      id?: string;
      method?: string;
      url?: string;
    }>();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.debug({
          reqId: req.id,
          route: `${req.method} ${req.url}`,
          ms: Date.now() - start,
          msg: 'handler completed',
        });
      }),
    );
  }
}
