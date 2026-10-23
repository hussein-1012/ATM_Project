import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AUTH_THROTTLE } from '../../common/throttler/throttle-presets';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateProfileDto,
} from '../users/dto/update-profile.dto';
import { UsersService } from '../users/users.service';

@ApiTags('auth/me')
@ApiBearerAuth('bearer')
@Controller('auth/me')
export class AccountController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.users.toDto(await this.users.getByIdOrFail(user.id));
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile (name, travel mode, voice guidance, language)' })
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.users.toDto(await this.users.updateProfile(user.id, dto));
  }

  @Throttle(AUTH_THROTTLE)
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password (revokes all refresh tokens)' })
  @ApiOkResponse({ schema: { example: { changed: true } } })
  @ApiUnauthorizedResponse({ description: 'INVALID_CURRENT_PASSWORD' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: boolean }> {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Throttle(AUTH_THROTTLE)
  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete user account',
    description:
      'Requires password confirmation. Soft deletes account, anonymizes personal data, and revokes all refresh tokens while preserving community reports.',
  })
  @ApiNoContentResponse({ description: 'Account deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'INVALID_PASSWORD — password confirmation failed' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    const userDoc = await this.users.getByIdOrFail(user.id);
    const valid = await this.users.verifyPassword(userDoc, dto.password);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'Password confirmation failed',
        code: 'INVALID_PASSWORD',
      });
    }

    await this.refreshTokens.revokeAllForUser(user.id);
    await this.users.softDeleteAndAnonymize(user.id);
  }
}
