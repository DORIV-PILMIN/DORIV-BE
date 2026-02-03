import { ApiProperty } from '@nestjs/swagger';
import { OauthUserDto } from './oauth-user.dto';

export class OauthLoginResponseDto {
  // 액세스 토큰
  @ApiProperty({ example: 'access.jwt.token' })
  accessToken!: string;

  // 리프레시 토큰
  @ApiProperty({ example: 'refresh.jwt.token' })
  refreshToken!: string;

  // 토큰 타입
  @ApiProperty({ example: 'bearer' })
  tokenType!: 'bearer';

  // 액세스 토큰 만료까지 남은 시간(초)
  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  // 리프레시 토큰 만료까지 남은 시간(초)
  @ApiProperty({ example: 604800 })
  refreshTokenExpiresIn!: number;

  // 신규 회원 여부
  @ApiProperty({ example: true })
  isNewUser!: boolean;

  // 로그인 사용자 정보
  @ApiProperty({ type: () => OauthUserDto })
  user!: OauthUserDto;
}
