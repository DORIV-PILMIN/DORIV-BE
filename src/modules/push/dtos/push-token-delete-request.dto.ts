import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PushTokenDeleteRequestDto {
  @ApiProperty({ example: 'fcm-token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}
