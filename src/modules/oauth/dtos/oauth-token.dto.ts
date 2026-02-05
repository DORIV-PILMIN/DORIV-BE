import { ApiProperty } from '@nestjs/swagger';

export class OauthTokenDto {
  @ApiProperty({ example: 'access.jwt.token' })
  accessToken!: string;

  @ApiProperty({ example: 'refresh.jwt.token' })
  refreshToken!: string;

  @ApiProperty({ example: 'bearer' })
  tokenType!: 'bearer';

  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  @ApiProperty({ example: 604800 })
  refreshTokenExpiresIn!: number;
}
