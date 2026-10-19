import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { RECENT_SEARCH_MAX_LENGTH } from '../../../common/constants';

export class CreateRecentSearchDto {
  @ApiProperty({ example: 'بنك مصر الفيوم', minLength: 1, maxLength: RECENT_SEARCH_MAX_LENGTH })
  @IsString()
  @Length(1, RECENT_SEARCH_MAX_LENGTH)
  query!: string;
}

export class RecentSearchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'بنك مصر الفيوم' })
  query!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class RecentSearchListDto {
  @ApiProperty({ type: [RecentSearchResponseDto] })
  items!: RecentSearchResponseDto[];
}
