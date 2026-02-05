import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OauthLoginRequestDto } from './dtos/oauth-login-request.dto';
import { OauthLoginResponseDto } from './dtos/oauth-login-response.dto';
import { OauthRefreshRequestDto } from './dtos/oauth-refresh-request.dto';
import { OauthService } from './services/oauth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { OauthUserDto } from './dtos/oauth-user.dto';

@ApiTags('oauth')
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('login')
  @ApiOperation({ summary: 'OAuth 로그인' })
  @ApiBody({ type: OauthLoginRequestDto })
  @ApiOkResponse({
    type: OauthLoginResponseDto,
    description: '토큰과 사용자 정보',
  })
  login(@Body() dto: OauthLoginRequestDto): Promise<OauthLoginResponseDto> {
    return this.oauthService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Access Token 갱신' })
  @ApiBody({ type: OauthRefreshRequestDto })
  @ApiOkResponse({
    type: OauthLoginResponseDto,
    description: '갱신된 토큰과 사용자 정보',
  })
  refresh(@Body() dto: OauthRefreshRequestDto): Promise<OauthLoginResponseDto> {
    return this.oauthService.refresh(dto);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '로그인 사용자 정보' })
  @ApiOkResponse({ type: OauthUserDto })
  getUser(@CurrentUserId() userId: string): Promise<OauthUserDto> {
    return this.oauthService.getUser(userId);
  }
}
