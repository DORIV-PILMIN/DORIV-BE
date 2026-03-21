import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { webcrypto } from 'node:crypto';
import { OauthLoginRequestDto } from '../dtos/oauth-login-request.dto';
import { OauthProvider } from '../dtos/oauth-provider.enum';

type ProviderTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
};

export type ProviderUserProfile = {
  providerUserId: string;
  email: string | null;
  name: string;
  profileImage: string | null;
};

type GoogleIdTokenHeader = {
  alg?: string;
  kid?: string;
};

type GoogleIdTokenPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

type GoogleJwk = JsonWebKey & {
  alg?: string;
  kid?: string;
  kty?: string;
  use?: string;
};

type GoogleJwkSet = {
  keys?: GoogleJwk[];
};

type CachedGoogleJwkSet = {
  expiresAt: number;
  keysByKid: Map<string, GoogleJwk>;
};

@Injectable()
export class OauthProviderService {
  private readonly logger = new Logger(OauthProviderService.name);
  private googleJwkCache: CachedGoogleJwkSet | null = null;

  constructor(private readonly configService: ConfigService) {}

  async exchangeCodeForToken(
    dto: OauthLoginRequestDto,
  ): Promise<ProviderTokenResponse> {
    switch (dto.provider) {
      case OauthProvider.KAKAO:
        return this.exchangeKakaoToken(dto);
      case OauthProvider.GOOGLE:
        return this.exchangeGoogleToken(dto);
      default:
        throw new BadRequestException('Unsupported OAuth provider.');
    }
  }

  async fetchUserProfile(
    provider: OauthProvider,
    accessToken: string,
    idToken?: string,
  ): Promise<ProviderUserProfile> {
    switch (provider) {
      case OauthProvider.KAKAO:
        return this.fetchKakaoProfile(accessToken);
      case OauthProvider.GOOGLE:
        return this.fetchGoogleProfile(accessToken, idToken);
      default:
        throw new BadRequestException('Unsupported OAuth provider.');
    }
  }

  private async exchangeKakaoToken(
    dto: OauthLoginRequestDto,
  ): Promise<ProviderTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'KAKAO_CLIENT_SECRET',
    );
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: dto.code,
      redirect_uri: dto.redirectUri,
    });

    const data = await this.postForm(
      'https://kauth.kakao.com/oauth/token',
      body,
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
    };
  }

  private async exchangeGoogleToken(
    dto: OauthLoginRequestDto,
  ): Promise<ProviderTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'GOOGLE_CLIENT_SECRET',
    );
    const body = new URLSearchParams({
      code: dto.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: dto.redirectUri,
      grant_type: 'authorization_code',
    });

    if (dto.codeVerifier) {
      body.append('code_verifier', dto.codeVerifier);
    }

    const data = await this.postForm(
      'https://oauth2.googleapis.com/token',
      body,
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
    };
  }

  private async fetchKakaoProfile(
    accessToken: string,
  ): Promise<ProviderUserProfile> {
    const data = await this.getJson(
      'https://kapi.kakao.com/v2/user/me',
      accessToken,
    );
    const kakaoAccount = data.kakao_account ?? {};
    const profile = kakaoAccount.profile ?? data.properties ?? {};
    const name =
      profile.nickname ??
      (kakaoAccount.email ? kakaoAccount.email.split('@')[0] : 'kakao_user');

    return {
      providerUserId: String(data.id),
      email: kakaoAccount.email ?? null,
      name,
      profileImage: profile.profile_image_url ?? profile.profile_image ?? null,
    };
  }

  private async fetchGoogleProfile(
    accessToken: string,
    idToken?: string,
  ): Promise<ProviderUserProfile> {
    if (idToken) {
      const profileFromIdToken =
        await this.tryBuildGoogleProfileFromIdToken(idToken);
      if (profileFromIdToken) {
        return profileFromIdToken;
      }
    }

    const data = await this.getJson(
      'https://openidconnect.googleapis.com/v1/userinfo',
      accessToken,
    );
    const name =
      data.name ?? (data.email ? data.email.split('@')[0] : 'google_user');

    return {
      providerUserId: String(data.sub),
      email: data.email ?? null,
      name,
      profileImage: data.picture ?? null,
    };
  }

  private async tryBuildGoogleProfileFromIdToken(
    idToken: string,
  ): Promise<ProviderUserProfile | null> {
    try {
      return await this.buildGoogleProfileFromIdToken(idToken);
    } catch (error) {
      this.logger.warn(
        `Falling back to Google userinfo endpoint: ${this.describeError(error)}`,
      );
      return null;
    }
  }

  private async buildGoogleProfileFromIdToken(
    idToken: string,
  ): Promise<ProviderUserProfile> {
    const { encodedHeader, encodedPayload, header, payload, signature } =
      this.parseJwt(idToken);

    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Google ID token header is invalid.');
    }

    const googleClientId =
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    if (!this.hasExpectedAudience(payload.aud, googleClientId)) {
      throw new UnauthorizedException('Google ID token audience is invalid.');
    }

    if (
      payload.iss !== 'https://accounts.google.com' &&
      payload.iss !== 'accounts.google.com'
    ) {
      throw new UnauthorizedException('Google ID token issuer is invalid.');
    }

    if (
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now() ||
      typeof payload.sub !== 'string' ||
      !payload.sub
    ) {
      throw new UnauthorizedException('Google ID token payload is invalid.');
    }

    const jwk = await this.getGoogleJwk(header.kid);
    const verified = await this.verifyGoogleJwtSignature(
      `${encodedHeader}.${encodedPayload}`,
      signature,
      jwk,
    );

    if (!verified) {
      throw new UnauthorizedException('Google ID token signature is invalid.');
    }

    const name =
      payload.name ??
      (payload.email ? payload.email.split('@')[0] : 'google_user');

    return {
      providerUserId: payload.sub,
      email: payload.email ?? null,
      name,
      profileImage: payload.picture ?? null,
    };
  }

  private parseJwt(token: string): {
    encodedHeader: string;
    encodedPayload: string;
    header: GoogleIdTokenHeader;
    payload: GoogleIdTokenPayload;
    signature: Uint8Array;
  } {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Google ID token format is invalid.');
    }

    try {
      return {
        encodedHeader,
        encodedPayload,
        header: JSON.parse(
          Buffer.from(encodedHeader, 'base64url').toString('utf8'),
        ) as GoogleIdTokenHeader,
        payload: JSON.parse(
          Buffer.from(encodedPayload, 'base64url').toString('utf8'),
        ) as GoogleIdTokenPayload,
        signature: Buffer.from(encodedSignature, 'base64url'),
      };
    } catch {
      throw new UnauthorizedException('Google ID token format is invalid.');
    }
  }

  private hasExpectedAudience(
    audience: string | string[] | undefined,
    expectedAudience: string,
  ): boolean {
    if (typeof audience === 'string') {
      return audience === expectedAudience;
    }

    if (Array.isArray(audience)) {
      return audience.includes(expectedAudience);
    }

    return false;
  }

  private async getGoogleJwk(kid: string): Promise<GoogleJwk> {
    const cached = await this.getCachedGoogleJwkSet(false);
    const cachedJwk = cached.keysByKid.get(kid);
    if (cachedJwk) {
      return cachedJwk;
    }

    const refreshed = await this.getCachedGoogleJwkSet(true);
    const refreshedJwk = refreshed.keysByKid.get(kid);
    if (!refreshedJwk) {
      throw new UnauthorizedException('Google ID token signing key is missing.');
    }

    return refreshedJwk;
  }

  private async getCachedGoogleJwkSet(
    forceRefresh: boolean,
  ): Promise<CachedGoogleJwkSet> {
    if (
      !forceRefresh &&
      this.googleJwkCache &&
      this.googleJwkCache.expiresAt > Date.now()
    ) {
      return this.googleJwkCache;
    }

    const response = await this.fetchWithTimeout(
      'https://www.googleapis.com/oauth2/v3/certs',
      {},
    );
    const data = (await this.safeJson(response)) as GoogleJwkSet;

    if (!response.ok || !Array.isArray(data.keys)) {
      throw new BadGatewayException('Failed to fetch Google signing keys.');
    }

    const keysByKid = new Map<string, GoogleJwk>();
    for (const key of data.keys) {
      if (key.kid) {
        keysByKid.set(key.kid, key);
      }
    }

    if (keysByKid.size === 0) {
      throw new BadGatewayException('Google signing keys are unavailable.');
    }

    this.googleJwkCache = {
      keysByKid,
      expiresAt: Date.now() + this.getMaxAgeMs(response.headers.get('cache-control')),
    };

    return this.googleJwkCache;
  }

  private getMaxAgeMs(cacheControlHeader: string | null): number {
    const defaultTtlMs = 5 * 60 * 1000;
    if (!cacheControlHeader) {
      return defaultTtlMs;
    }

    const match = cacheControlHeader.match(/max-age=(\d+)/i);
    if (!match) {
      return defaultTtlMs;
    }

    const maxAgeSeconds = Number(match[1]);
    if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
      return defaultTtlMs;
    }

    return maxAgeSeconds * 1000;
  }

  private async verifyGoogleJwtSignature(
    signingInput: string,
    signature: Uint8Array,
    jwk: GoogleJwk,
  ): Promise<boolean> {
    if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256') {
      throw new UnauthorizedException('Google signing key is invalid.');
    }

    const algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    } as const;
    const key = await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      algorithm,
      false,
      ['verify'],
    );

    return webcrypto.subtle.verify(
      algorithm.name,
      key,
      signature,
      new TextEncoder().encode(signingInput),
    );
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'unknown error';
  }

  private async postForm(
    url: string,
    body: URLSearchParams,
  ): Promise<Record<string, any>> {
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      throw this.toProviderException(response.status, data, 'exchange_token');
    }

    return data;
  }

  private async getJson(
    url: string,
    accessToken: string,
  ): Promise<Record<string, any>> {
    const response = await this.fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      throw this.toProviderException(response.status, data, 'fetch_profile');
    }

    return data;
  }

  private getOauthTimeoutMs(): number {
    return this.configService.getOrThrow<number>('OAUTH_HTTP_TIMEOUT_MS');
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.getOauthTimeoutMs();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new GatewayTimeoutException('OAuth provider request timed out.');
      }
      throw new ServiceUnavailableException(
        'OAuth provider request failed due to a network error.',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toProviderException(
    status: number,
    details: Record<string, any>,
    action: 'exchange_token' | 'fetch_profile',
  ): Error {
    if (action === 'exchange_token') {
      if (status === 400) {
        return new BadRequestException({
          message: 'OAuth authorization data is invalid.',
          statusCode: status,
          details,
        });
      }
      if (status === 401 || status === 403) {
        return new UnauthorizedException({
          message: 'OAuth provider rejected the token exchange request.',
          statusCode: status,
          details,
        });
      }
    }

    if (action === 'fetch_profile' && (status === 401 || status === 403)) {
      return new UnauthorizedException({
        message: 'OAuth access token is invalid or expired.',
        statusCode: status,
        details,
      });
    }

    if (status === 429) {
      return new ServiceUnavailableException({
        message: 'OAuth provider is rate limited.',
        statusCode: status,
        details,
      });
    }

    if (status >= 500) {
      return new BadGatewayException({
        message: 'OAuth provider request failed.',
        statusCode: status,
        details,
      });
    }

    return new BadGatewayException({
      message: 'OAuth provider request failed.',
      statusCode: status,
      details,
    });
  }

  private async safeJson(response: Response): Promise<Record<string, any>> {
    try {
      return (await response.json()) as Record<string, any>;
    } catch {
      return {};
    }
  }
}
