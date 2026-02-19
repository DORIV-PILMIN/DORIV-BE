import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'some-cursor' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  startCursor?: string;
}
