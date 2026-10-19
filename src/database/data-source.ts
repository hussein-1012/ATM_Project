import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { Atm } from '../modules/atms/entities/atm.entity';
import { AtmReport } from '../modules/atms/entities/atm-report.entity';
import { Favorite } from '../modules/favorites/entities/favorite.entity';
import { RecentSearch } from '../modules/settings/entities/recent-search.entity';

dotenv.config({ quiet: true });

const isTs = __filename.endsWith('.ts');

/**
 * DataSource used by the TypeORM CLI and by the standalone migrate/import
 * scripts (docker-compose importer service). The Nest app has its own
 * TypeOrmModule config in database.module.ts — synchronize is false in both.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://aqrab:aqrab@localhost:5432/aqrab',
  entities: [User, RefreshToken, Atm, AtmReport, Favorite, RecentSearch],
  migrations: [`${__dirname}/migrations/*.${isTs ? 'ts' : 'js'}`],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
