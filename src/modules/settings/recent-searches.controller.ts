import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateRecentSearchDto, RecentSearchListDto, RecentSearchResponseDto } from './dto/recent-search.dto';
import { RecentSearchesService } from './recent-searches.service';
import { RECENT_SEARCHES_KEEP } from '../../common/constants';

@ApiTags('recent-searches')
@ApiBearerAuth('bearer')
@Controller('me/recent-searches')
export class RecentSearchesController {
  constructor(private readonly recent: RecentSearchesService) {}

  @Get()
  @ApiOperation({ summary: `List up to ${RECENT_SEARCHES_KEEP} most recent searches` })
  @ApiOkResponse({ type: RecentSearchListDto })
  async list(@CurrentUser() user: AuthUser): Promise<RecentSearchListDto> {
    const items = await this.recent.list(user.id);
    return { items };
  }

  @Post()
  @ApiOperation({ summary: 'Record a search (deduplicated, keeps the last 10)' })
  @ApiCreatedResponse({ type: RecentSearchResponseDto })
  async add(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRecentSearchDto,
  ): Promise<RecentSearchResponseDto> {
    return this.recent.add(user.id, dto.query);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Clear all recent searches' })
  @ApiNoContentResponse()
  async clear(@CurrentUser() user: AuthUser): Promise<void> {
    await this.recent.clear(user.id);
  }
}
