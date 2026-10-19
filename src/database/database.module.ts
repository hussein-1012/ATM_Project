import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../common/redis/redis.service';
import { RedisThrottlerStorage } from '../common/throttler/redis-throttler.storage';

/**
 * TypeORM wiring: migrations-only config (synchronize is ALWAYS false),
 * plus a hook that binds the Redis throttler storage to the Redis service.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<string>('nodeEnv') === 'development' ? ['warn', 'error'] : false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    RedisThrottlerStorage.bind(this.redis);
  }
}
