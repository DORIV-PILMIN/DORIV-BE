import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  ParseEnumPipe,
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
import { OauthAuthorizeUrlResponseDto } from './dtos/oauth-authorize-url-response.dto';
import { OauthCallbackExchangeRequestDto } from './dtos/oauth-callback-exchange-request.dto';
import { OauthService } from './services/oauth.service';
import { OauthCallbackTicketService } from './services/oauth-callback-ticket.service';
import { OauthAuthorizationSessionService } from './services/oauth-authorization-session.service';
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
    private readonly authorizationSessionService: OauthAuthorizationSessionService,
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

  @Get('url')
  @ApiOperation({ summary: 'OAuth 인가 URL 발급 (PKCE/state 서버 관리)' })
  @ApiQuery({ name: 'provider', enum: OauthProvider, required: true })
  @ApiOkResponse({ type: OauthAuthorizeUrlResponseDto })
  getAuthorizeUrl(
    @Query('provider', new ParseEnumPipe(OauthProvider))
    provider: OauthProvider,
    @Res({ passthrough: true }) res: Response,
  ): OauthAuthorizeUrlResponseDto {
    const redirectUri = this.getProviderRedirectUri(provider);
    const authorizationPayload = this.authorizationSessionService.create(
      provider,
      redirectUri,
    );

    const isSecureCookie = redirectUri.startsWith('https://');
    res.cookie(
      this.getOauthSessionCookieName(provider),
      authorizationPayload.sessionId,
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureCookie,
        path: '/oauth',
        maxAge: 10 * 60 * 1000,
      },
    );

    return {
      url: this.buildProviderAuthorizeUrl(provider, redirectUri, {
        state: authorizationPayload.state,
        codeChallenge: authorizationPayload.codeChallenge,
      }),
    };
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
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiQuery({ name: 'error_description', required: false })
  @ApiFoundResponse({
    description:
      'OAuth 성공 시 FE_URL/oauth/google/callback 으로 ticket 쿼리와 함께 리다이렉트',
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Headers('cookie') cookieHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleCallbackRedirect(
      OauthProvider.GOOGLE,
      code,
      state,
      error,
      errorDescription,
      cookieHeader,
      res,
    );
  }

  @Get('kakao/callback')
  @ApiOperation({ summary: 'Kakao OAuth callback' })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiQuery({ name: 'error_description', required: false })
  @ApiFoundResponse({
    description:
      'OAuth 성공 시 FE_URL/oauth/kakao/callback 으로 ticket 쿼리와 함께 리다이렉트',
  })
  async kakaoCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Headers('cookie') cookieHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleCallbackRedirect(
      OauthProvider.KAKAO,
      code,
      state,
      error,
      errorDescription,
      cookieHeader,
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
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    errorDescription: string | undefined,
    cookieHeader: string | undefined,
    res: Response,
  ): Promise<void> {
    if (!state) {
      throw new BadRequestException('Missing OAuth state.');
    }

    const sessionId = this.readOauthSessionIdFromCookie(provider, cookieHeader);
    if (!sessionId) {
      throw new UnauthorizedException('Missing OAuth session.');
    }

    const session = this.authorizationSessionService.consume(
      provider,
      sessionId,
      state,
    );
    const loginResponse = await this.loginFromCallback(
      provider,
      session.redirectUri,
      session.codeVerifier,
      code,
      error,
      errorDescription,
    );

    this.clearOauthSessionCookie(provider, session.redirectUri, res);
    const ticket = this.callbackTicketService.issue(loginResponse);
    const redirectUrl = this.buildSuccessRedirectUrl(provider, ticket);
    res.redirect(302, redirectUrl);
  }

  private loginFromCallback(
    provider: OauthProvider,
    redirectUri: string,
    codeVerifier: string | undefined,
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
      codeVerifier,
    });
  }

  private buildSuccessRedirectUrl(
    provider: OauthProvider,
    ticket: string,
  ): string {
    const frontendUrl = this.configService.get<string>('OAUTH_FRONTEND_URL');
    if (!frontendUrl) {
      throw new InternalServerErrorException(
        'OAUTH_FRONTEND_URL is required.',
      );
    }

    const normalizedBase = frontendUrl.endsWith('/')
      ? frontendUrl
      : `${frontendUrl}/`;
    const url = new URL(`oauth/${provider}/callback`, normalizedBase);
    url.searchParams.set('ticket', ticket);
    return url.toString();
  }

  private getProviderRedirectUri(provider: OauthProvider): string {
    if (provider === OauthProvider.GOOGLE) {
      return this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    }
    return this.configService.getOrThrow<string>('KAKAO_REDIRECT_URI');
  }

  private buildProviderAuthorizeUrl(
    provider: OauthProvider,
    redirectUri: string,
    payload: { state: string; codeChallenge?: string },
  ): string {
    if (provider === OauthProvider.GOOGLE) {
      if (!payload.codeChallenge) {
        throw new InternalServerErrorException(
          'Google PKCE code challenge is missing.',
        );
      }

      const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: payload.state,
        code_challenge: payload.codeChallenge,
        code_challenge_method: 'S256',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: payload.state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  private getOauthSessionCookieName(provider: OauthProvider): string {
    return `oauth_session_${provider}`;
  }

  private readOauthSessionIdFromCookie(
    provider: OauthProvider,
    cookieHeader: string | undefined,
  ): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookieName = this.getOauthSessionCookieName(provider);
    const cookies = cookieHeader.split(';');
    for (const rawCookie of cookies) {
      const [name, ...valueParts] = rawCookie.trim().split('=');
      if (name === cookieName) {
        const value = valueParts.join('=');
        if (value) {
          return decodeURIComponent(value);
        }
      }
    }

    return null;
  }

  private clearOauthSessionCookie(
    provider: OauthProvider,
    redirectUri: string,
    res: Response,
  ): void {
    const isSecureCookie = redirectUri.startsWith('https://');
    res.clearCookie(this.getOauthSessionCookieName(provider), {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookie,
      path: '/oauth',
    });
  }
}
