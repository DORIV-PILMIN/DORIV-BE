import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PushSendLogDto {
  @ApiProperty({ example: 'log-uuid' })
  logId!: string;

  @ApiPropertyOptional({ example: 'token-uuid', nullable: true })
  pushTokenId!: string | null;

  @ApiProperty({ example: '일주일이 지났어요!' })
  title!: string;

  @ApiProperty({ example: '지금 복습하면 기억이 더 오래가요.' })
  body!: string;

  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiPropertyOptional({ example: 'UNREGISTERED', nullable: true })
  errorCode!: string | null;

  @ApiProperty({ example: '2026-02-06T10:00:00.000Z' })
  createdAt!: Date;
}
