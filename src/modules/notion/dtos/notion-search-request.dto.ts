import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class NotionSearchRequestDto {
  @ApiPropertyOptional({ example: 'interview' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  query?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  pageSize?: number;

  @ApiPropertyOptional({ example: '35b54ef2-17bf-4c89-b828-6fd91b02db4d' })
  @IsUUID()
  @IsOptional()
  startCursor?: string;
}
