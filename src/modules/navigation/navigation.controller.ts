import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RouteRequestDto, RouteResponseDto } from './dto/route.dto';
import { NavigationService } from './navigation.service';

@ApiTags('navigation')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Public()
  @Post('route')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Compute a route from the user to an ATM (guest)',
    description:
      'Uses OSRM/ORS per ROUTING_PROVIDER; on any provider failure it transparently returns a straight-line fallback with approximate:true. Responses are cached ~60 s.',
  })
  @ApiOkResponse({ type: RouteResponseDto })
  @ApiNotFoundResponse({ description: 'ATM_NOT_FOUND' })
  route(@Body() dto: RouteRequestDto): Promise<RouteResponseDto> {
    return this.navigation.route({ from: dto.from, atmId: dto.atmId, mode: dto.mode });
  }
}
