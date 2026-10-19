import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import {
  FavoriteListDto,
  FavoriteListQueryDto,
  FavoriteResponseDto,
} from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

const uuid = () => new ParseUUIDPipe({ version: '4' });

@ApiTags('favorites')
@ApiBearerAuth('bearer')
@Controller('me/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List saved ATMs (newest first, optional distances)' })
  @ApiOkResponse({ type: FavoriteListDto })
  list(@CurrentUser() user: AuthUser, @Query() query: FavoriteListQueryDto): Promise<FavoriteListDto> {
    const ref =
      query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : undefined;
    return this.favorites.list(user.id, ref);
  }

  @Put(':atmId')
  @ApiOperation({ summary: 'Save an ATM (idempotent)' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  @ApiNotFoundResponse({ description: 'ATM_NOT_FOUND' })
  async add(
    @CurrentUser() user: AuthUser,
    @Param('atmId', uuid()) atmId: string,
  ): Promise<FavoriteResponseDto> {
    const favorite = await this.favorites.add(user.id, atmId);
    return { favorite: { atmId: favorite.atmId, createdAt: favorite.createdAt } };
  }

  @Delete(':atmId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a saved ATM (idempotent)' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('atmId', uuid()) atmId: string,
  ): Promise<void> {
    await this.favorites.remove(user.id, atmId);
  }
}
