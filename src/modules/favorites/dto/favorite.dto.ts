import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AtmResponseDto } from '../../atms/dto/atm-response.dto';

export class FavoriteDto {
  @ApiProperty({ format: 'uuid' })
  atmId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class FavoriteResponseDto {
  @ApiProperty({ type: FavoriteDto })
  favorite!: FavoriteDto;
}

export class FavoriteListQueryDto {
  @ApiPropertyOptional({ example: 29.30837, description: 'Optional reference latitude for distances' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 30.84278, description: 'Optional reference longitude for distances' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class FavoriteMetaDto {
  @ApiProperty({ example: 3 })
  count!: number;
}

export class FavoriteListDto {
  @ApiProperty({ type: [AtmResponseDto] })
  items!: AtmResponseDto[];

  @ApiProperty({ type: FavoriteMetaDto })
  meta!: FavoriteMetaDto;
}
