// Loads .env before any module decorators are evaluated, so route-level
// throttle presets can read process.env at import time.
import 'dotenv/config';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  app.flushLogs();

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/v1  (docs: /docs)`);
}

void bootstrap();
