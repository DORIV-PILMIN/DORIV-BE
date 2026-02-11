import { ApiProperty } from '@nestjs/swagger';

export class PushVapidKeyResponseDto {
  @ApiProperty({ example: 'BKf...publicKey' })
  vapidPublicKey!: string;
}
