import { ApiProperty } from '@nestjs/swagger';

export class OauthAuthorizeUrlResponseDto {
  @ApiProperty({
    example:
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=xxx&redirect_uri=yyy&response_type=code',
  })
  url!: string;
}
