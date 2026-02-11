import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PushSendRequestDto {
  @ApiPropertyOptional({ example: 'Doriv 알림' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '오늘 학습 질문이 도착했습니다.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({ example: { type: 'study', scheduleId: 'uuid' } })
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}
