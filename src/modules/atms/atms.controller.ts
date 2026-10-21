import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AtmsService } from './atms.service';
import { AtmDetailQueryDto, NearbyQueryDto, SearchQueryDto } from './dto/atm-query.dto';
import {
  AtmDetailResponseDto,
  NearbyResponseDto,
  SearchResponseDto,
} from './dto/atm-response.dto';

/**
 * Read-only ATM endpoints (guest-accessible). `nearby`/`search` are declared
 * before `:id` so the static routes are not shadowed by the param route.
 */
@ApiTags('atms')
@Controller('atms')
export class AtmsController {
  constructor(private readonly atms: AtmsService) {}

  @Public()
  @Get('nearby')
  @ApiOperation({
    summary: 'ATMs near a coordinate, nearest first',
    description: 'Uses the MongoDB 2dsphere index ($geoNear).',
  })
  @ApiOkResponse({ type: NearbyResponseDto })
  nearby(@Query() dto: NearbyQueryDto): Promise<NearbyResponseDto> {
    return this.atms.nearby(dto);
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search ATMs by text / bank / accessibility',
    description:
      'The query is Arabic-normalized (hamza, taa-marbuta, diacritics, case) and matched against a text-indexed blob.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  search(@Query() dto: SearchQueryDto): Promise<SearchResponseDto> {
    return this.atms.search(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'ATM detail with a crowd-sourced report summary',
    description: 'reportSummary is community-reported and NEVER bank-confirmed.',
  })
  @ApiOkResponse({ type: AtmDetailResponseDto })
  detail(
    @Param('id', new ParseObjectIdPipe()) id: string,
    @Query() dto: AtmDetailQueryDto,
  ): Promise<AtmDetailResponseDto> {
    const ref = dto.lat !== undefined && dto.lng !== undefined ? { lat: dto.lat, lng: dto.lng } : undefined;
    return this.atms.detail(id, ref);
  }
}
