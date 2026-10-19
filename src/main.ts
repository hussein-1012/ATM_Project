// Loads .env before any module decorators are evaluated, so route-level
// throttle presets can read process.env at import time.
import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { requestId } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.flushLogs();

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

  // Swagger at /docs
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
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/v1  (docs: /docs)`);
}

void bootstrap();
