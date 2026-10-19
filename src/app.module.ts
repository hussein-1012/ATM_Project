import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { envSchema } from './config/env.schema';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { genReqId } from './common/logger/request-id';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AtmsModule } from './modules/atms/atms.module';
import { SearchModule } from './modules/search/search.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthModule } from './modules/health/health.module';
import { DatabaseModule } from './database/database.module';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';

@Module({
  imports: [
    // Structured logging (pino) with request id propagation.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId,
        autoLogging: {
          ignore: (req) => req.url === '/v1/health' || req.url === '/docs-json',
        },
        serializers: {
          req(req: any) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              // never log auth headers or bodies
              headers: { 'user-agent': req.headers['user-agent'], 'content-type': req.headers['content-type'] },
            };
          },
          res(res: any) {
            return { statusCode: res.statusCode };
          },
        },
      },
    }),

    // Validated configuration (zod).
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          throw new Error(`Invalid environment configuration — ${issues}`);
        }
        return parsed.data as Record<string, unknown>;
      },
    }),

    // Rate limiting with Redis-backed counters.
    ThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('throttle.ttl') ?? 60_000,
            limit: config.get<number>('throttle.limit') ?? 300,
          },
        ],
        storage: new RedisThrottlerStorage(),
      }),
      inject: [ConfigService],
    }),

    CommonModule,
    DatabaseModule,

    AuthModule,
    UsersModule,
    SearchModule,
    AtmsModule,
    ReportsModule,
    FavoritesModule,
    NavigationModule,
    SettingsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
