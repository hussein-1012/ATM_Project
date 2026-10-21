import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisService } from '../common/redis/redis.service';
import { RedisThrottlerStorage } from '../common/throttler/redis-throttler.storage';

/**
 * Mongoose wiring: connects to MongoDB using MONGO_URI from env.
 * Also binds the Redis throttler storage to the Redis service on init.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
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
