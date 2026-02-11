import { ApiProperty } from '@nestjs/swagger';

export class PushSendResponseDto {
  @ApiProperty({ example: 1 })
  successCount!: number;

  @ApiProperty({ example: 0 })
  failureCount!: number;

  @ApiProperty({ example: 0 })
  invalidTokenRemoved!: number;
}
