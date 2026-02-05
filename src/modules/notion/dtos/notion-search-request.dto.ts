import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class NotionSearchRequestDto {
  // 검색어(선택)
  @ApiPropertyOptional({ example: '면접' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  query?: string;

  // 페이지 크기(선택, 기본 10, 최대 20)
  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  pageSize?: number;

  // 페이지네이션 커서(선택)
  @ApiPropertyOptional({ example: 'some-cursor' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  startCursor?: string;
}
