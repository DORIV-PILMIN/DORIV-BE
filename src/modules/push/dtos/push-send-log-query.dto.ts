import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PushSendLogQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
