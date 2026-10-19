import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { requestId } from './common/middleware/request-id.middleware';

export interface ConfigureAppOptions {
  /** Mount Swagger at /docs (disabled in tests). Defaults to true. */
  docs?: boolean;
}

/**
 * Applies the runtime configuration shared by `main.ts` and the e2e tests:
 * pino logging, helmet, CORS, request ids, `/v1` URI versioning, strict DTO
 * validation and Swagger. Keeping this in one place guarantees the tests
 * exercise the exact same request pipeline as production.
 */
export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}): void {
  app.useLogger(app.get(Logger));

  // Security headers
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS
  const config = app.get(ConfigService);
  const origins = config.get<string[]>('cors.origins') ?? ['*'];
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
  });

  // Request ids (before any route)
  app.use(requestId);

  // URI versioning: /v1/...
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global validation: strict DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (options.docs !== false) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aqrab Makina Leek API')
      .setDescription(
        'Nearest ATM For You — find and navigate to ATMs in Fayoum, Egypt. ' +
          'All responses are language-neutral JSON. Community-reported ATM status is ' +
          'crowd-sourced and NEVER bank-confirmed.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
  }
}
