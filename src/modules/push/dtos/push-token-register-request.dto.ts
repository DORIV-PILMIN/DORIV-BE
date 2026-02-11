import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PushTokenRegisterRequestDto {
  @ApiProperty({ example: 'fcm-token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;

  @ApiPropertyOptional({ example: 'WEB' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  platform?: string;

  @ApiPropertyOptional({ example: 'Chrome' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  device?: string;

  @ApiPropertyOptional({ example: 'ANDROID_WEB' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  deviceType?: string;
}
