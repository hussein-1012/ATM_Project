import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Logger } from 'nestjs-pino';
import { RefreshToken, RefreshTokenSchema } from './entities/refresh-token.entity';
import { AuthController } from './auth.controller';
import { AccountController } from './account.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { OtpService } from './otp.service';
import { ConsoleMailService, MAIL_SERVICE, ResendMailService } from './mail.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
    UsersModule,
  ],
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    RefreshTokenService,
    OtpService,
    {
      provide: MAIL_SERVICE,
      useFactory: (config: ConfigService, logger: Logger) => {
        const apiKey = config.get<string>('resend.apiKey');
        if (apiKey) {
          return new ResendMailService(config, logger);
        }
        return new ConsoleMailService(logger);
      },
      inject: [ConfigService, Logger],
    },
  ],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
