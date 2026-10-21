import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshToken, RefreshTokenSchema } from './entities/refresh-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { OtpService } from './otp.service';
import { ConsoleMailService, MAIL_SERVICE } from './mail.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    OtpService,
    { provide: MAIL_SERVICE, useClass: ConsoleMailService },
  ],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
