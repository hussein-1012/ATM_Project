import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { ChangePasswordDto, UpdateProfileDto } from '../users/dto/update-profile.dto';
import { UsersService } from '../users/users.service';

@ApiTags('account')
@ApiBearerAuth('bearer')
@Controller('me')
export class AccountController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.users.toDto(await this.users.getByIdOrFail(user.id));
  }

  @Patch()
  @ApiOperation({ summary: 'Update name / travel mode / voice guidance / language' })
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.users.toDto(await this.users.updateProfile(user.id, dto));
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password (revokes all refresh tokens)' })
  @ApiOkResponse({ schema: { example: { changed: true } } })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: boolean }> {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete the account',
    description:
      'Soft delete: anonymizes personal data, revokes all refresh tokens, keeps community reports.',
  })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser): Promise<void> {
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.users.softDeleteAndAnonymize(user.id);
  }
}
