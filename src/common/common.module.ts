import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RedisService } from './redis/redis.service';

/**
 * Global common module: JWT module wiring, Redis client, shared guards/filters.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret') ?? '',
        signOptions: { expiresIn: (config.get<string>('jwt.accessTtl') ?? '15m') as never },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class CommonModule {}
