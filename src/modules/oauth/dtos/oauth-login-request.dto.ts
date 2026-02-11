import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OauthProvider } from './oauth-provider.enum';

export class OauthLoginRequestDto {
  @ApiProperty({
    enum: OauthProvider,
    enumName: 'OauthProvider',
    example: OauthProvider.GOOGLE,
    description: 'google 또는 kakao',
  })
  @IsEnum(OauthProvider)
  provider!: OauthProvider;

  @ApiProperty({ example: 'authorization-code-from-provider' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code!: string;

  @ApiProperty({ example: 'https://example.com/oauth/callback' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  redirectUri!: string;

  @ApiPropertyOptional({ example: 'code-verifier-for-pkce' })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  codeVerifier?: string;
}
