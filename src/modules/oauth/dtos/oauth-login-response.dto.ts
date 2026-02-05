import { ApiProperty } from '@nestjs/swagger';
import { OauthUserDto } from './oauth-user.dto';
import { OauthTokenDto } from './oauth-token.dto';

export class OauthLoginResponseDto {
  @ApiProperty({ type: () => OauthTokenDto })
  tokens!: OauthTokenDto;

  @ApiProperty({ type: () => OauthUserDto })
  user!: OauthUserDto;

  @ApiProperty({ example: true })
  isNewUser!: boolean;
}
