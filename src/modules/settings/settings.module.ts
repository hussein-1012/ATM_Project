import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecentSearch } from './entities/recent-search.entity';
import { RecentSearchesService } from './recent-searches.service';
import { RecentSearchesController } from './recent-searches.controller';
import { AccountController } from './account.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([RecentSearch]), AuthModule, UsersModule],
  controllers: [AccountController, RecentSearchesController],
  providers: [RecentSearchesService],
  exports: [RecentSearchesService],
})
export class SettingsModule {}
