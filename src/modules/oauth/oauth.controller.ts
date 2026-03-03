import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OauthLoginRequestDto } from './dtos/oauth-login-request.dto';
import { OauthLoginResponseDto } from './dtos/oauth-login-response.dto';
import { OauthRefreshRequestDto } from './dtos/oauth-refresh-request.dto';
import { OauthProvider } from './dtos/oauth-provider.enum';
import { OauthCallbackExchangeRequestDto } from './dtos/oauth-callback-exchange-request.dto';
import { OauthService } from './services/oauth.service';
import { OauthCallbackTicketService } from './services/oauth-callback-ticket.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { OauthUserDto } from './dtos/oauth-user.dto';

@ApiTags('oauth')
@Controller('oauth')
export class OauthController {
  constructor(
    private readonly oauthService: OauthService,
    private readonly configService: ConfigService,
    private readonly callbackTicketService: OauthCallbackTicketService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'OAuth 로그인' })
  @ApiBody({
    type: OauthLoginRequestDto,
    examples: {
      google: {
        summary: 'Google 로그인',
        value: {
          provider: 'google',
          code: 'authorization-code-from-google',
          redirectUri: 'https://example.com/oauth/callback',
          codeVerifier: 'code-verifier-for-pkce',
        },
      },
      kakao: {
        summary: 'Kakao 로그인',
        value: {
          provider: 'kakao',
          code: 'authorization-code-from-kakao',
          redirectUri: 'https://example.com/oauth/callback',
          codeVerifier: 'code-verifier-for-pkce',
        },
      },
    },
  })
  @ApiOkResponse({
    type: OauthLoginResponseDto,
    description: '토큰과 사용자 정보',
  })
  login(@Body() dto: OauthLoginRequestDto): Promise<OauthLoginResponseDto> {
    return this.oauthService.login(dto);
  }

  @Post('callback/exchange')
  @ApiOperation({ summary: 'OAuth 콜백 티켓 교환' })
  @ApiBody({ type: OauthCallbackExchangeRequestDto })
  @ApiOkResponse({
    type: OauthLoginResponseDto,
    description: '티켓 교환으로 받은 토큰과 사용자 정보',
  })
  exchangeCallbackTicket(
    @Body() dto: OauthCallbackExchangeRequestDto,
  ): OauthLoginResponseDto {
    return this.callbackTicketService.consume(dto.ticket);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiQuery({ name: 'error_description', required: false })
  @ApiFoundResponse({
    description:
      'OAuth 성공 시 OAUTH_SUCCESS_REDIRECT_URL(/main)에 ticket 쿼리와 함께 리다이렉트',
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUri =
      this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    await this.handleCallbackRedirect(
      OauthProvider.GOOGLE,
      redirectUri,
      code,
      error,
      errorDescription,
      res,
    );
  }

  @Get('kakao/callback')
  @ApiOperation({ summary: 'Kakao OAuth callback' })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiQuery({ name: 'error_description', required: false })
  @ApiFoundResponse({
    description:
      'OAuth 성공 시 OAUTH_SUCCESS_REDIRECT_URL(/main)에 ticket 쿼리와 함께 리다이렉트',
  })
  async kakaoCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUri = this.configService.getOrThrow<string>(
      'KAKAO_REDIRECT_URI',
    );
    await this.handleCallbackRedirect(
      OauthProvider.KAKAO,
      redirectUri,
      code,
      error,
      errorDescription,
      res,
    );
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
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '로그인 사용자 정보' })
  @ApiOkResponse({ type: OauthUserDto })
  getUser(@CurrentUserId() userId: string): Promise<OauthUserDto> {
    return this.oauthService.getUser(userId);
  }

  private async handleCallbackRedirect(
    provider: OauthProvider,
    redirectUri: string,
    code: string | undefined,
    error: string | undefined,
    errorDescription: string | undefined,
    res: Response,
  ): Promise<void> {
    const loginResponse = await this.loginFromCallback(
      provider,
      redirectUri,
      code,
      error,
      errorDescription,
    );
    const ticket = this.callbackTicketService.issue(loginResponse);
    const redirectUrl = this.buildSuccessRedirectUrl(ticket);
    res.redirect(302, redirectUrl);
  }

  private loginFromCallback(
    provider: OauthProvider,
    redirectUri: string,
    code: string | undefined,
    error: string | undefined,
    errorDescription: string | undefined,
  ): Promise<OauthLoginResponseDto> {
    if (error) {
      throw new UnauthorizedException(
        errorDescription
          ? `OAuth provider returned an error: ${error} (${errorDescription})`
          : `OAuth provider returned an error: ${error}`,
      );
    }

    if (!code) {
      throw new BadRequestException('Missing authorization code.');
    }

    return this.oauthService.login({
      provider,
      code,
      redirectUri,
    });
  }

  private buildSuccessRedirectUrl(ticket: string): string {
    const configuredUrl =
      this.configService.get<string>('OAUTH_SUCCESS_REDIRECT_URL') ??
      this.configService.get<string>('NOTION_OAUTH_SUCCESS_REDIRECT_URL');

    if (!configuredUrl) {
      throw new InternalServerErrorException(
        'OAUTH_SUCCESS_REDIRECT_URL is required.',
      );
    }

    const url = new URL(configuredUrl);
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/main';
    }
    url.searchParams.set('ticket', ticket);
    return url.toString();
  }
}

