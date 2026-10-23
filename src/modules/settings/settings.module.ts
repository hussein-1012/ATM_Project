import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecentSearch, RecentSearchSchema } from './entities/recent-search.entity';
import { RecentSearchesService } from './recent-searches.service';
import { RecentSearchesController } from './recent-searches.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RecentSearch.name, schema: RecentSearchSchema }]),
  ],
  controllers: [RecentSearchesController],
  providers: [RecentSearchesService],
  exports: [RecentSearchesService],
})
export class SettingsModule {}
