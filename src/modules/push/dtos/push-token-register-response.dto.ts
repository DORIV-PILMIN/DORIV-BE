import { ApiProperty } from '@nestjs/swagger';

export class PushTokenRegisterResponseDto {
  @ApiProperty({ example: 'push-token-uuid' })
  pushTokenId!: string;

  @ApiProperty({ example: 'fcm-token' })
  token!: string;

  @ApiProperty({ example: 'WEB' })
  platform!: string;

  @ApiProperty({ example: 'ANDROID_WEB' })
  deviceType!: string;
}
