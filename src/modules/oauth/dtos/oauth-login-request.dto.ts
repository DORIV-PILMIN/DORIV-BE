import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OauthProvider } from './oauth-provider.enum';

export class OauthLoginRequestDto {
  // OAuth 공급자(카카오/구글)
  @ApiProperty({ enum: OauthProvider, example: OauthProvider.GOOGLE })
  @IsEnum(OauthProvider)
  provider!: OauthProvider;

  // 인가 코드
  @ApiProperty({ example: 'authorization-code-from-provider' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code!: string;

  // 리다이렉트 URI(콘솔에 등록한 값과 동일해야 함)
  @ApiProperty({ example: 'https://example.com/oauth/callback' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  redirectUri!: string;

  // PKCE 코드 검증자(선택)
  @ApiPropertyOptional({ example: 'code-verifier-for-pkce' })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  codeVerifier?: string;
}
