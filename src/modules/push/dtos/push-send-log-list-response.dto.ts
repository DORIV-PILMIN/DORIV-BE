import { ApiProperty } from '@nestjs/swagger';
import { PushSendLogDto } from './push-send-log.dto';

export class PushSendLogListResponseDto {
  @ApiProperty({ type: [PushSendLogDto] })
  logs!: PushSendLogDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}
