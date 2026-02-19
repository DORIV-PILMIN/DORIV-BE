import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OauthRefreshRequestDto {
  @ApiProperty({ example: 'refresh.jwt.token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  refreshToken!: string;
}
