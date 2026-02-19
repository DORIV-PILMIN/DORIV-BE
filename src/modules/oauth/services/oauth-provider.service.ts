import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class OauthProviderService {
  constructor(private readonly configService: ConfigService) {}

  async exchangeCodeForToken(dto: OauthLoginRequestDto): Promise<ProviderTokenResponse> {
    switch (dto.provider) {
      case OauthProvider.KAKAO:
        return this.exchangeKakaoToken(dto);
      case OauthProvider.GOOGLE:
        return this.exchangeGoogleToken(dto);
      default:
        throw new BadRequestException('Unsupported OAuth provider.');
    }
  }

  async fetchUserProfile(provider: OauthProvider, accessToken: string): Promise<ProviderUserProfile> {
    switch (provider) {
      case OauthProvider.KAKAO:
        return this.fetchKakaoProfile(accessToken);
      case OauthProvider.GOOGLE:
        return this.fetchGoogleProfile(accessToken);
      default:
        throw new BadRequestException('Unsupported OAuth provider.');
    }
  }

  private async exchangeKakaoToken(dto: OauthLoginRequestDto): Promise<ProviderTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('KAKAO_CLIENT_SECRET');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: dto.code,
      redirect_uri: dto.redirectUri,
    });

    const data = await this.postForm('https://kauth.kakao.com/oauth/token', body);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
    };
  }

  private async exchangeGoogleToken(dto: OauthLoginRequestDto): Promise<ProviderTokenResponse> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
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

    const data = await this.postForm('https://oauth2.googleapis.com/token', body);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
    };
  }

  private async fetchKakaoProfile(accessToken: string): Promise<ProviderUserProfile> {
    const data = await this.getJson('https://kapi.kakao.com/v2/user/me', accessToken);
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

  private async fetchGoogleProfile(accessToken: string): Promise<ProviderUserProfile> {
    const data = await this.getJson('https://openidconnect.googleapis.com/v1/userinfo', accessToken);
    const name = data.name ?? (data.email ? data.email.split('@')[0] : 'google_user');

    return {
      providerUserId: String(data.sub),
      email: data.email ?? null,
      name,
      profileImage: data.picture ?? null,
    };
  }

  private async postForm(url: string, body: URLSearchParams): Promise<Record<string, any>> {
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      throw new BadRequestException({
        message: 'Failed to exchange OAuth token.',
        details: data,
      });
    }

    return data;
  }

  private async getJson(url: string, accessToken: string): Promise<Record<string, any>> {
    const response = await this.fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      throw new BadRequestException({
        message: 'Failed to fetch OAuth user profile.',
        details: data,
      });
    }

    return data;
  }

  private getOauthTimeoutMs(): number {
    return this.configService.getOrThrow<number>('OAUTH_HTTP_TIMEOUT_MS');
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.getOauthTimeoutMs();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadRequestException('OAuth provider request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async safeJson(response: Response): Promise<Record<string, any>> {
    try {
      return (await response.json()) as Record<string, any>;
    } catch {
      return {};
    }
  }
}
