import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OauthLoginRequestDto } from './dtos/oauth-login-request.dto';
import { OauthLoginResponseDto } from './dtos/oauth-login-response.dto';
import { OauthRefreshRequestDto } from './dtos/oauth-refresh-request.dto';
import { OauthService } from './services/oauth.service';

@ApiTags('oauth')
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('login')
  @ApiOperation({ summary: 'OAuth 로그인/회원가입' })
  @ApiBody({ type: OauthLoginRequestDto })
  @ApiOkResponse({
    type: OauthLoginResponseDto,
    description: '액세스/리프레시 토큰과 사용자 정보',
  })
  login(@Body() dto: OauthLoginRequestDto): Promise<OauthLoginResponseDto> {
    return this.oauthService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Access Token 재발급' })
  @ApiBody({ type: OauthRefreshRequestDto })
  @ApiOkResponse({
    type: OauthLoginResponseDto,
    description: '새 토큰 발급 결과',
  })
  refresh(@Body() dto: OauthRefreshRequestDto): Promise<OauthLoginResponseDto> {
    return this.oauthService.refresh(dto);
  }
}
