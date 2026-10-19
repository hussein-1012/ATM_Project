import { Module } from '@nestjs/common';
import { AtmsModule } from '../atms/atms.module';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { FallbackRoutingProvider } from './routing/fallback.provider';
import { OrsRoutingProvider } from './routing/ors.provider';
import { OsrmRoutingProvider } from './routing/osrm.provider';

@Module({
  imports: [AtmsModule],
  controllers: [NavigationController],
  providers: [
    NavigationService,
    FallbackRoutingProvider,
    OsrmRoutingProvider,
    OrsRoutingProvider,
  ],
  exports: [NavigationService],
})
export class NavigationModule {}
